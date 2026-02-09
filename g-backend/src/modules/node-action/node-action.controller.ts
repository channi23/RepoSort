import { Body, Controller, Inject, Logger, Post, Req, Get, Param, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../../queue/queues/queue.names';
import { NodeActionService } from './node-action.service';
import { CreateNodeActionDto } from './dto/create-node-action.dto';
import { PolicyService } from '../governance/policy.service';
import { ApprovalService } from '../governance/approval.service';
import { AuditService } from '../governance/audit.service';
import { Roles } from '../governance/roles.decorator';

@Controller('node-actions')
export class NodeActionController {
  private readonly logger = new Logger(NodeActionController.name);

  constructor(
    private readonly actions: NodeActionService,
    private readonly policy: PolicyService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
    @Inject(QUEUE_REGISTRY) private readonly queues: any,
  ) {}

  @Post('refactor')
  @Roles('developer', 'admin')
  async refactor(@Body() dto: CreateNodeActionDto, @Req() req: Request) {
    return this.startAction('REFACTOR', dto, req);
  }

  @Post('harden')
  @Roles('developer', 'admin')
  async harden(@Body() dto: CreateNodeActionDto, @Req() req: Request) {
    return this.startAction('HARDEN', dto, req);
  }

  @Post('add-tests')
  @Roles('developer', 'admin')
  async addTests(@Body() dto: CreateNodeActionDto, @Req() req: Request) {
    return this.startAction('ADD_TESTS', dto, req);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.actions.getAction(id);
  }

  private async startAction(type: 'REFACTOR' | 'HARDEN' | 'ADD_TESTS', dto: CreateNodeActionDto, req: Request) {
    const traceId = (req as any).traceId;
    const actorRole = (req as any).actorRole ?? 'developer';

    const { nodeActionId, planId, repoSnapshotId } = await this.actions.createAction({
      type,
      projectId: dto.projectId,
      graphSnapshotId: dto.graphSnapshotId,
      selectedNodeIds: dto.selectedNodeIds,
      prompt: dto.prompt,
      traceId,
    });

    const targetNodePaths = await this.actions.getNodePaths(dto.graphSnapshotId, dto.selectedNodeIds);
    const decision = this.policy.evaluateAction({
      actionType: type,
      projectId: dto.projectId,
      nodeIds: dto.selectedNodeIds,
      prompt: dto.prompt,
      targetNodePaths,
    });

    await this.audit.log({
      projectId: dto.projectId,
      traceId,
      actorRole,
      action: 'node-action.request',
      entityType: 'NodeAction',
      entityId: nodeActionId,
      decision: decision.decision,
      meta: { type, reasons: decision.reasons },
    });

    if (decision.decision === 'DENY') {
      const reason = decision.reasons.join('; ');
      await this.actions.updateActionStatus(nodeActionId, 'FAILED', reason || 'Denied by policy');
      throw new ForbiddenException(reason || 'Denied by policy');
    }

    if (decision.decision === 'REQUIRE_APPROVAL') {
      await this.actions.updateActionStatus(nodeActionId, 'PENDING_APPROVAL', null);
      const approval = await this.approvals.createPending({
        projectId: dto.projectId,
        nodeActionId,
        planId,
        reasons: decision.reasons,
      });
      this.logger.log(`[traceId=${traceId}] nodeAction pending approval action=${nodeActionId} approval=${approval.id}`);
      return { queued: false, requiresApproval: true, approvalId: approval.id, nodeActionId, planId, traceId };
    }

    const job = await this.queues.plan.add(QUEUE_NAMES.CREATE_PLAN, {
      nodeActionId,
      planId,
      projectId: dto.projectId,
      graphSnapshotId: dto.graphSnapshotId,
      repoSnapshotId,
      traceId,
    });

    this.logger.log(`[traceId=${traceId}] nodeAction queued type=${type} action=${nodeActionId} plan=${planId} job=${job.id}`);

    return { queued: true, jobId: job.id, nodeActionId, planId, traceId, queue: QUEUE_NAMES.CREATE_PLAN };
  }
}
