import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_NAMES } from '../queues/queue.names';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';

type CreatePlanJob = {
  projectId: string;
  planId: string;
  graphSnapshotId: string;
  nodeActionId?: string;
  prompt: string;
  selectedNodeIds: string[];
  traceId?: string;
};

// Minimal shape we need from QUEUE_REGISTRY for Stage-8 chaining
type QueueRegistry = {
  apply: { add: (name: string, data: any) => Promise<any> };
};

@Injectable()
export class CreatePlanWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CreatePlanWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    const queues = this.moduleRef.get<QueueRegistry>(QUEUE_REGISTRY, { strict: false });
    if (!queues?.apply?.add) {
      // If this throws, QueueModule isn't loaded or QUEUE_REGISTRY isn't exported properly
      throw new Error('QUEUE_REGISTRY missing or does not expose queues.apply.add (check QueueModule wiring)');
    }

    this.worker = new Worker(
      QUEUE_NAMES.CREATE_PLAN,
      async (job: Job<CreatePlanJob>) => {
        const {
          planId,
          projectId,
          nodeActionId,
          graphSnapshotId,
          prompt = '',
          selectedNodeIds = [],
          traceId,
        } = job.data;

        // defensive: ensure array
        const safeSelectedNodeIds = Array.isArray(selectedNodeIds) ? selectedNodeIds : [];

        this.logger.log(
          `[traceId=${traceId}] create plan start plan=${planId} graph=${graphSnapshotId} selected=${safeSelectedNodeIds.length}`,
        );

        // 1) load selected nodes
        const nodes = await this.prisma.node.findMany({
          where: {
            graphSnapshotId,
            id: { in: safeSelectedNodeIds },
          },
          select: { id: true, type: true, label: true, path: true },
        });

        if (nodes.length === 0) {
          this.logger.warn(`[traceId=${traceId}] no selected nodes found in graph=${graphSnapshotId}`);
        }

        // 2) deterministic intent → step types
        const intent = String(prompt ?? '').toLowerCase();
        const stepTypes: Array<'REFACTOR' | 'HARDEN' | 'ADD_TESTS' | 'CLEANUP' | 'DOCS'> = [];

        const add = (t: typeof stepTypes[number]) => {
          if (!stepTypes.includes(t)) stepTypes.push(t);
        };

        if (/(refactor|restructure|rename|split)/.test(intent)) add('REFACTOR');
        if (/(validate|sanitize|auth|security|secure|harden|injection|xss|csrf)/.test(intent)) add('HARDEN');
        if (/(test|coverage|jest|unit|e2e)/.test(intent)) add('ADD_TESTS');
        if (/(cleanup|format|lint|prettier|eslint|dead code)/.test(intent)) add('CLEANUP');
        if (/(docs|readme|document)/.test(intent)) add('DOCS');
        if (stepTypes.length === 0) add('REFACTOR');

        // 3) impacted scope (MVP)
        const impactedNodeIds = nodes.map((n) => n.id);

        // 4) generate steps
        const steps = stepTypes.map((type, idx) => {
          const title =
            type === 'REFACTOR'
              ? 'Refactor selected area'
              : type === 'HARDEN'
              ? 'Harden security / validation'
              : type === 'ADD_TESTS'
              ? 'Add tests for changes'
              : type === 'CLEANUP'
              ? 'Cleanup and formatting'
              : 'Update documentation';

          return {
            planId,
            order: idx + 1,
            type,
            title,
            rationale:
              `Derived from prompt intent; targets selected nodes and immediate scope. ` +
              `Selected: ${nodes.length} node(s).`,
            targetNodeIds: impactedNodeIds,
            meta: { selectedNodes: nodes, prompt },
          };
        });

        // 5) persist steps
        await this.prisma.planStep.deleteMany({ where: { planId } });
        await this.prisma.planStep.createMany({ data: steps });

        this.logger.log(`[traceId=${traceId}] create plan done plan=${planId} steps=${steps.length}`);

        // 6) Stage 8 chaining (only for node actions)
        if (nodeActionId) {
          const nodeAction = await this.prisma.nodeAction.findUnique({
            where: { id: nodeActionId },
            select: { id: true, repoSnapshotId: true, runId: true, status: true },
          });
          if (!nodeAction) throw new Error(`NodeAction not found: ${nodeActionId}`);

          let runId = nodeAction.runId;
          let runStatus: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | null = null;

          if (runId) {
            const existingRun = await this.prisma.run.findUnique({
              where: { id: runId },
              select: { id: true, status: true },
            });

            if (existingRun) {
              runStatus = existingRun.status;
              if (existingRun.status !== 'RUNNING' && existingRun.status !== 'SUCCEEDED') {
                await this.prisma.run.update({
                  where: { id: runId },
                  data: {
                    projectId,
                    repoSnapshotId: nodeAction.repoSnapshotId,
                    planId,
                    status: 'QUEUED',
                    startedAt: null,
                    finishedAt: null,
                  },
                });
                runStatus = 'QUEUED';
              }
            } else {
              const run = await this.prisma.run.create({
                data: {
                  projectId,
                  repoSnapshotId: nodeAction.repoSnapshotId,
                  planId,
                  status: 'QUEUED',
                },
                select: { id: true },
              });
              runId = run.id;
              runStatus = 'QUEUED';
              await this.prisma.nodeAction.update({
                where: { id: nodeAction.id },
                data: { runId },
              });
            }
          } else {
            const existingRun = await this.prisma.run.findFirst({
              where: {
                projectId,
                repoSnapshotId: nodeAction.repoSnapshotId,
                planId,
              },
              orderBy: { createdAt: 'desc' },
              select: { id: true, status: true },
            });

            if (existingRun) {
              runId = existingRun.id;
              runStatus = existingRun.status;
              await this.prisma.nodeAction.update({
                where: { id: nodeAction.id },
                data: { runId },
              });
            } else {
              const run = await this.prisma.run.create({
                data: {
                  projectId,
                  repoSnapshotId: nodeAction.repoSnapshotId,
                  planId,
                  status: 'QUEUED',
                },
                select: { id: true },
              });
              runId = run.id;
              runStatus = 'QUEUED';
              await this.prisma.nodeAction.update({
                where: { id: nodeAction.id },
                data: { runId },
              });
            }
          }

          if (runStatus === 'RUNNING' || runStatus === 'SUCCEEDED') {
            this.logger.log(
              `[traceId=${traceId}] APPLY_PLAN enqueue skipped run=${runId} status=${runStatus} nodeAction=${nodeAction.id}`,
            );
            return { ok: true, planId, runId, skipped: true };
          }

          await this.prisma.nodeAction.updateMany({
            where: { id: nodeActionId, status: { in: ['QUEUED', 'FAILED'] } },
            data: { status: 'RUNNING', error: null },
          });

          await queues.apply.add(QUEUE_NAMES.APPLY_PLAN, {
            runId,
            traceId,
          });

          this.logger.log(
            `[traceId=${traceId}] APPLY_PLAN auto-enqueued run=${runId} nodeAction=${nodeAction.id}`,
          );

          return { ok: true, planId, runId };
        }

        return { ok: true, planId, steps: steps.length };
      },
      { connection: { host: 'localhost', port: 6379 } },
    );

    this.worker.on('failed', (job, err) => {
      const data: any = job?.data;
      this.logger.error(
        `[traceId=${data?.traceId}] CREATE_PLAN failed jobId=${job?.id} planId=${data?.planId}`,
        err.stack,
      );
    });

    this.logger.log(`CreatePlanWorker listening on queue: ${QUEUE_NAMES.CREATE_PLAN}`);
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }
}
