import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../../queue/queues/queue.names';
import { AuditService } from './audit.service';

@Injectable()
export class ApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(QUEUE_REGISTRY) private readonly queues: any,
  ) {}

  async createPending(input: {
    projectId: string;
    reasons: string[];
    nodeActionId?: string;
    planId?: string;
    runId?: string;
  }) {
    return this.prisma.approvalRequest.create({
      data: {
        projectId: input.projectId,
        nodeActionId: input.nodeActionId,
        planId: input.planId,
        runId: input.runId,
        status: 'PENDING',
        reasons: input.reasons,
      },
    });
  }

  async list(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    return this.prisma.approvalRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async approve(id: string, opts: { traceId?: string; actorRole: string }) {
    const approval = await this.prisma.approvalRequest.findUnique({ where: { id } });
    if (!approval) throw new NotFoundException(`ApprovalRequest not found: ${id}`);

    if (approval.status !== 'PENDING') {
      return { alreadyDecided: true, approval };
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        decidedAt: new Date(),
        decidedByRole: opts.actorRole,
      },
    });

    if (updated.nodeActionId) {
      const action = await this.prisma.nodeAction.findUnique({ where: { id: updated.nodeActionId } });
      if (action) {
        if (!action.planId) {
          throw new Error(`NodeAction has no planId: ${action.id}`);
        }
        if (action.projectId !== updated.projectId) {
          await this.audit.log({
            projectId: updated.projectId,
            actorRole: 'system',
            action: 'approval.scope',
            entityType: 'NodeAction',
            entityId: action.id,
            decision: 'DENY',
            meta: { reason: 'nodeAction project mismatch' },
          });
          throw new Error(`Cross-project scope mismatch for nodeAction=${action.id}`);
        }

        if (action.planId) {
          const plan = await this.prisma.plan.findUnique({
            where: { id: action.planId },
            select: { projectId: true },
          });
          if (!plan || plan.projectId !== updated.projectId) {
            await this.audit.log({
              projectId: updated.projectId,
              actorRole: 'system',
              action: 'approval.scope',
              entityType: 'Plan',
              entityId: action.planId,
              decision: 'DENY',
              meta: { reason: 'plan project mismatch' },
            });
            throw new Error(`Cross-project scope mismatch for plan=${action.planId}`);
          }
        }

        const snapshot = await this.prisma.repoSnapshot.findUnique({
          where: { id: action.repoSnapshotId },
          select: { projectId: true },
        });
        if (!snapshot || snapshot.projectId !== updated.projectId) {
          await this.audit.log({
            projectId: updated.projectId,
            actorRole: 'system',
            action: 'approval.scope',
            entityType: 'RepoSnapshot',
            entityId: action.repoSnapshotId,
            decision: 'DENY',
            meta: { reason: 'repoSnapshot project mismatch' },
          });
          throw new Error(`Cross-project scope mismatch for repoSnapshot=${action.repoSnapshotId}`);
        }

        if (action.runId) {
          const run = await this.prisma.run.findUnique({
            where: { id: action.runId },
            select: { projectId: true },
          });
          if (!run || run.projectId !== updated.projectId) {
            await this.audit.log({
              projectId: updated.projectId,
              actorRole: 'system',
              action: 'approval.scope',
              entityType: 'Run',
              entityId: action.runId,
              decision: 'DENY',
              meta: { reason: 'run project mismatch' },
            });
            throw new Error(`Cross-project scope mismatch for run=${action.runId}`);
          }
        }

        await this.prisma.nodeAction.update({
          where: { id: action.id },
          data: { status: 'QUEUED', error: null },
        });

        await this.queues.plan.add(QUEUE_NAMES.CREATE_PLAN, {
          nodeActionId: action.id,
          planId: action.planId,
          projectId: action.projectId,
          graphSnapshotId: action.graphSnapshotId,
          prompt: action.prompt,
          selectedNodeIds: Array.isArray(action.selectedNodeIds) ? action.selectedNodeIds : [],
          traceId: opts.traceId,
        });
      }
    }

    await this.audit.log({
      projectId: updated.projectId,
      traceId: opts.traceId,
      actorRole: opts.actorRole,
      action: 'approval.approve',
      entityType: 'ApprovalRequest',
      entityId: updated.id,
      decision: 'ALLOW',
      meta: { nodeActionId: updated.nodeActionId, runId: updated.runId, planId: updated.planId },
    });

    return { approval: updated, resumedAt: 'CREATE_PLAN' };
  }

  async reject(id: string, opts: { traceId?: string; actorRole: string }) {
    const approval = await this.prisma.approvalRequest.findUnique({ where: { id } });
    if (!approval) throw new NotFoundException(`ApprovalRequest not found: ${id}`);

    if (approval.status !== 'PENDING') {
      return { alreadyDecided: true, approval };
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        decidedAt: new Date(),
        decidedByRole: opts.actorRole,
      },
    });

    if (updated.nodeActionId) {
      await this.prisma.nodeAction.updateMany({
        where: { id: updated.nodeActionId },
        data: { status: 'FAILED', error: 'Rejected by policy' },
      });
    }

    await this.audit.log({
      projectId: updated.projectId,
      traceId: opts.traceId,
      actorRole: opts.actorRole,
      action: 'approval.reject',
      entityType: 'ApprovalRequest',
      entityId: updated.id,
      decision: 'DENY',
      meta: { nodeActionId: updated.nodeActionId, runId: updated.runId, planId: updated.planId },
    });

    return { approval: updated };
  }
}
