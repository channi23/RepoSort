import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_NAMES } from '../queues/queue.names';

type CreatePlanJob = {
  projectId: string;
  planId: string;
  graphSnapshotId: string;
  prompt: string;
  selectedNodeIds: string[];
  traceId?: string;
};

@Injectable()
export class CreatePlanWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CreatePlanWorker.name);
  private worker!: Worker;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.CREATE_PLAN,
      async (job: Job<CreatePlanJob>) => {
        const { planId, graphSnapshotId, prompt, selectedNodeIds, traceId } = job.data;

        this.logger.log(
          `[traceId=${traceId}] create plan start plan=${planId} graph=${graphSnapshotId} selected=${selectedNodeIds.length}`,
        );

        // 1) load selected nodes (must belong to graphSnapshotId)
        const nodes = await this.prisma.node.findMany({
          where: {
            graphSnapshotId,
            id: { in: selectedNodeIds },
          },
          select: { id: true, type: true, label: true, path: true },
        });

        if (nodes.length === 0) {
          this.logger.warn(`[traceId=${traceId}] no selected nodes found in graph=${graphSnapshotId}`);
        }

        // 2) deterministic intent → step types (keyword rules)
        const intent = prompt.toLowerCase();

        const stepTypes: Array<'REFACTOR' | 'HARDEN' | 'ADD_TESTS' | 'CLEANUP' | 'DOCS'> = [];

        const add = (t: typeof stepTypes[number]) => {
          if (!stepTypes.includes(t)) stepTypes.push(t);
        };

        if (/(refactor|restructure|rename|split)/.test(intent)) add('REFACTOR');
        if (/(validate|sanitize|auth|security|secure|harden|injection|xss|csrf)/.test(intent)) add('HARDEN');
        if (/(test|coverage|jest|unit|e2e)/.test(intent)) add('ADD_TESTS');
        if (/(cleanup|format|lint|prettier|eslint|dead code)/.test(intent)) add('CLEANUP');
        if (/(docs|readme|document)/.test(intent)) add('DOCS');

        // fallback
        if (stepTypes.length === 0) add('REFACTOR');

        // 3) compute impacted scope (minimal MVP)
        // Start with selected nodes only (later: expand by edges/subgraph)
        const impactedNodeIds = nodes.map((n) => n.id);

        // 4) generate ordered steps
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

          const rationale =
            `Derived from prompt intent; targets selected nodes and immediate scope. ` +
            `Selected: ${nodes.length} node(s).`;

          return {
            planId,
            order: idx + 1,
            type,
            title,
            rationale,
            targetNodeIds: impactedNodeIds,
            meta: {
              selectedNodes: nodes,
              prompt,
            },
          };
        });

        // 5) write steps to DB (replace if re-run)
        await this.prisma.planStep.deleteMany({ where: { planId } });
        await this.prisma.planStep.createMany({
          data: steps.map((s) => ({
            planId: s.planId,
            order: s.order,
            type: s.type,
            title: s.title,
            rationale: s.rationale,
            targetNodeIds: s.targetNodeIds,
            meta: s.meta,
          })),
        });

        this.logger.log(
          `[traceId=${traceId}] create plan done plan=${planId} steps=${steps.length}`,
        );

        return { ok: true, planId, steps: steps.length };
      },
      {
        connection: { host: 'localhost', port: 6379 },
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `[traceId=${(job?.data as any)?.traceId}] CREATE_PLAN failed jobId=${job?.id}`,
        err.stack,
      );
    });

    this.logger.log(`CreatePlanWorker listening on queue: ${QUEUE_NAMES.CREATE_PLAN}`);
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }
}
