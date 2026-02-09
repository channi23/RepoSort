import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../../db/prisma.service';
import { GeminiRunnerService } from '../../llm/gemini-runner.service';
import { GeminiService } from '../../llm/gemini.service';
import { AuditService } from '../../modules/governance/audit.service';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../queues/queue.names';

type CreatePlanJob = {
  projectId: string;
  planId: string;
  graphSnapshotId: string;
  nodeActionId?: string;
  prompt?: string;
  selectedNodeIds?: string[];
  traceId?: string;
};

type QueueRegistry = {
  apply: { add: (name: string, data: any) => Promise<any> };
};

type PlanStepType = 'REFACTOR' | 'HARDEN' | 'ADD_TESTS' | 'CLEANUP' | 'DOCS';

type GeminiPlan = {
  steps?: Array<{
    type?: string;
    title?: string;
    rationale?: string;
    targetNodePaths?: string[];
    targetNodeIds?: string[];
  }>;
  suggestedEdits?: Array<{ path?: string; instruction?: string }>;
};

const ALLOWED_STEP_TYPES: PlanStepType[] = ['REFACTOR', 'HARDEN', 'ADD_TESTS', 'CLEANUP', 'DOCS'];

@Injectable()
export class CreatePlanWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CreatePlanWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly geminiRunner: GeminiRunnerService,
    private readonly audit: AuditService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    const queues = this.moduleRef.get<QueueRegistry>(QUEUE_REGISTRY, { strict: false });
    if (!queues?.apply?.add) {
      throw new Error('QUEUE_REGISTRY missing or does not expose queues.apply.add (check QueueModule wiring)');
    }

    this.worker = new Worker(
      QUEUE_NAMES.CREATE_PLAN,
      async (job: Job<CreatePlanJob>) => {
        const { planId, projectId, nodeActionId, graphSnapshotId, traceId } = job.data;

        await this.audit.log({
          projectId,
          traceId,
          actorRole: 'system',
          action: 'worker.create-plan.start',
          entityType: 'Plan',
          entityId: planId,
          decision: 'ALLOW',
          meta: { nodeActionId: nodeActionId ?? null },
        });

        this.logger.log(`[traceId=${traceId}] [step=CREATE_PLAN] start plan=${planId} graph=${graphSnapshotId}`);

        const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
        if (!plan) throw new Error(`Plan not found: ${planId}`);
        if (plan.projectId !== projectId || plan.graphSnapshotId !== graphSnapshotId) {
          await this.audit.log({
            projectId,
            traceId,
            actorRole: 'system',
            action: 'worker.create-plan.scope',
            entityType: 'Plan',
            entityId: planId,
            decision: 'DENY',
            meta: { reason: 'plan/project/graph mismatch' },
          });
          throw new Error(`Cross-project scope mismatch for plan=${planId}`);
        }

        const prompt = (job.data.prompt ?? plan.prompt ?? '').trim();
        const selectedNodeIds = Array.isArray(job.data.selectedNodeIds)
          ? job.data.selectedNodeIds
          : Array.isArray(plan.selectedNodeIds)
            ? (plan.selectedNodeIds as string[])
            : [];

        const nodes = await this.prisma.node.findMany({
          where: {
            graphSnapshotId,
            id: { in: selectedNodeIds },
          },
          select: { id: true, type: true, label: true, path: true },
        });

        const latestRisks = await this.prisma.risk.findMany({
          where: { projectId, graphSnapshotId },
          orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
          take: 8,
          select: { severity: true, type: true, title: true },
        });

        const stepsAttr = await this.geminiRunner.runWithGeminiFirst({
          stepName: 'CREATE_PLAN',
          traceId,
          projectId,
          nodeActionId,
          geminiFn: async () => {
            this.gemini.assertConfigured();
            const rawGemini = await this.gemini.generateText(
              [
                'You are generating a safe software maintenance plan.',
                'Return JSON with shape: {"steps":[{"type","title","rationale","targetNodeIds"}],"suggestedEdits":[{"path","instruction"}]}',
                `Allowed step types: ${ALLOWED_STEP_TYPES.join(', ')}`,
              ].join('\n'),
              JSON.stringify({ prompt, selectedNodes: nodes, topRisks: latestRisks }).slice(0, 15_000),
              18_000,
            );
            if (!rawGemini) {
              throw new Error('Gemini returned empty response');
            }
            let geminiPlan: GeminiPlan | null = null;
            try {
              const normalized = rawGemini.startsWith('```')
                ? rawGemini.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
                : rawGemini;
              geminiPlan = JSON.parse(normalized) as GeminiPlan;
            } catch {
              if (this.gemini.isDebugSourceEnabled()) {
                this.logger.warn(
                  `[traceId=${traceId}] [step=CREATE_PLAN] invalid Gemini JSON raw=${rawGemini.slice(0, 2000)}`,
                );
              }
              throw new Error('Gemini returned non-JSON plan payload');
            }
            const validatedGeminiSteps = this.validateGeminiSteps(geminiPlan?.steps ?? [], nodes.map((n) => n.id));
            if (validatedGeminiSteps.length === 0) {
              if (this.gemini.isDebugSourceEnabled()) {
                this.logger.warn(
                  `[traceId=${traceId}] [step=CREATE_PLAN] invalid Gemini plan schema raw=${rawGemini.slice(0, 2000)}`,
                );
              }
              throw new Error('Gemini returned invalid plan steps');
            }
            return validatedGeminiSteps.map((step, idx) => ({
              planId,
              order: idx + 1,
              type: step.type,
              title: step.title,
              rationale: step.rationale,
              targetNodeIds: step.targetNodeIds,
              meta: {
                selectedNodes: nodes,
                prompt,
                suggestedEdits: idx === 0 ? geminiPlan?.suggestedEdits ?? [] : [],
              },
            }));
          },
          fallbackFn: async () => this.buildDeterministicSteps({ planId, prompt, nodes }),
        });
        const steps = stepsAttr.value;

        await this.prisma.planStep.deleteMany({ where: { planId } });
        if (steps.length > 0) {
          await this.prisma.planStep.createMany({ data: steps });
        }

        this.logger.log(
          `[traceId=${traceId}] [step=CREATE_PLAN] done [source=${stepsAttr.source}] model=${stepsAttr.model ?? 'n/a'} latencyMs=${stepsAttr.latencyMs} plan=${planId} steps=${steps.length}`,
        );

        if (nodeActionId) {
          const nodeAction = await this.prisma.nodeAction.findUnique({ where: { id: nodeActionId } });
          if (!nodeAction) throw new Error(`NodeAction not found: ${nodeActionId}`);

          if (
            nodeAction.projectId !== projectId ||
            nodeAction.planId !== planId ||
            nodeAction.repoSnapshotId == null
          ) {
            await this.audit.log({
              projectId,
              traceId,
              actorRole: 'system',
              action: 'worker.create-plan.scope',
              entityType: 'NodeAction',
              entityId: nodeActionId,
              decision: 'DENY',
              meta: { reason: 'nodeAction project/plan mismatch' },
            });
            throw new Error(`Cross-project scope mismatch for nodeAction=${nodeActionId}`);
          }

          const repoSnapshot = await this.prisma.repoSnapshot.findUnique({
            where: { id: nodeAction.repoSnapshotId },
            select: { projectId: true },
          });
          if (!repoSnapshot || repoSnapshot.projectId !== projectId) {
            await this.audit.log({
              projectId,
              traceId,
              actorRole: 'system',
              action: 'worker.create-plan.scope',
              entityType: 'RepoSnapshot',
              entityId: nodeAction.repoSnapshotId,
              decision: 'DENY',
              meta: { reason: 'repoSnapshot project mismatch' },
            });
            throw new Error(`Cross-project scope mismatch for repoSnapshot=${nodeAction.repoSnapshotId}`);
          }

          let runId = nodeAction.runId;
          let runStatus: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | null = null;

          if (runId) {
            const existingRun = await this.prisma.run.findUnique({
              where: { id: runId },
              select: { id: true, status: true, projectId: true },
            });

            if (existingRun && existingRun.projectId !== projectId) {
              await this.audit.log({
                projectId,
                traceId,
                actorRole: 'system',
                action: 'worker.create-plan.scope',
                entityType: 'Run',
                entityId: runId,
                decision: 'DENY',
                meta: { reason: 'run project mismatch' },
              });
              throw new Error(`Cross-project scope mismatch for run=${runId}`);
            }

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
              await this.prisma.nodeAction.update({ where: { id: nodeAction.id }, data: { runId } });
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
              await this.prisma.nodeAction.update({ where: { id: nodeAction.id }, data: { runId } });
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
              await this.prisma.nodeAction.update({ where: { id: nodeAction.id }, data: { runId } });
            }
          }

          if (runStatus === 'RUNNING' || runStatus === 'SUCCEEDED') {
            this.logger.log(`[traceId=${traceId}] APPLY_PLAN enqueue skipped run=${runId} status=${runStatus} nodeAction=${nodeAction.id}`);
            await this.audit.log({
              projectId,
              traceId,
              actorRole: 'system',
              action: 'worker.create-plan.done',
              entityType: 'Plan',
              entityId: planId,
              decision: 'ALLOW',
              meta: { runId, skippedApply: true },
            });
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

          this.logger.log(`[traceId=${traceId}] APPLY_PLAN auto-enqueued run=${runId} nodeAction=${nodeAction.id}`);

          await this.audit.log({
            projectId,
            traceId,
            actorRole: 'system',
            action: 'worker.create-plan.done',
            entityType: 'Plan',
            entityId: planId,
            decision: 'ALLOW',
            meta: { runId, steps: steps.length },
          });

          return { ok: true, planId, runId };
        }

        await this.audit.log({
          projectId,
          traceId,
          actorRole: 'system',
          action: 'worker.create-plan.done',
          entityType: 'Plan',
          entityId: planId,
          decision: 'ALLOW',
          meta: { steps: steps.length },
        });

        return { ok: true, planId, steps: steps.length };
      },
      { connection: { host: 'localhost', port: 6379 } },
    );

    this.worker.on('failed', async (job, err) => {
      const data: any = job?.data;
      this.logger.error(`[traceId=${data?.traceId}] CREATE_PLAN failed jobId=${job?.id} planId=${data?.planId}`, err.stack);
      if (data?.nodeActionId) {
        await this.prisma.nodeAction.updateMany({
          where: { id: data.nodeActionId },
          data: { status: 'FAILED', error: err?.message ?? String(err) },
        });
      }
      if (data?.projectId && data?.planId) {
        await this.audit.log({
          projectId: data.projectId,
          traceId: data.traceId,
          actorRole: 'system',
          action: 'worker.create-plan.failed',
          entityType: 'Plan',
          entityId: data.planId,
          decision: 'DENY',
          meta: { error: err?.message ?? String(err) },
        });
      }
    });

    this.logger.log(`CreatePlanWorker listening on queue: ${QUEUE_NAMES.CREATE_PLAN}`);
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }

  private buildDeterministicSteps(input: {
    planId: string;
    prompt: string;
    nodes: Array<{ id: string; type: string; label: string; path: string | null }>;
  }) {
    const stepTypes: PlanStepType[] = [];
    const intent = String(input.prompt ?? '').toLowerCase();
    const add = (t: PlanStepType) => {
      if (!stepTypes.includes(t)) stepTypes.push(t);
    };

    if (/(refactor|restructure|rename|split)/.test(intent)) add('REFACTOR');
    if (/(validate|sanitize|auth|security|secure|harden|injection|xss|csrf)/.test(intent)) add('HARDEN');
    if (/(test|coverage|jest|unit|e2e)/.test(intent)) add('ADD_TESTS');
    if (/(cleanup|format|lint|prettier|eslint|dead code)/.test(intent)) add('CLEANUP');
    if (/(docs|readme|document)/.test(intent)) add('DOCS');
    if (stepTypes.length === 0) add('REFACTOR');

    const impactedNodeIds = input.nodes.map((n) => n.id);

    return stepTypes.map((type, idx) => {
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
        planId: input.planId,
        order: idx + 1,
        type,
        title,
        rationale: `Derived from prompt intent; targets selected nodes and immediate scope. Selected: ${input.nodes.length} node(s).`,
        targetNodeIds: impactedNodeIds,
        meta: { selectedNodes: input.nodes, prompt: input.prompt },
      };
    });
  }

  private validateGeminiSteps(
    steps: GeminiPlan['steps'],
    fallbackNodeIds: string[],
  ): Array<{ type: PlanStepType; title: string; rationale: string; targetNodeIds: string[] }> {
    if (!Array.isArray(steps)) return [];

    const validated: Array<{ type: PlanStepType; title: string; rationale: string; targetNodeIds: string[] }> = [];
    for (const raw of steps) {
      const type = String(raw?.type ?? '').toUpperCase() as PlanStepType;
      if (!ALLOWED_STEP_TYPES.includes(type)) {
        continue;
      }

      const title = String(raw?.title ?? '').trim();
      if (!title) continue;

      const targetNodeIds = Array.isArray(raw?.targetNodeIds)
        ? raw!.targetNodeIds!.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [];

      validated.push({
        type,
        title,
        rationale: String(raw?.rationale ?? '').trim() || 'Generated by Gemini.',
        targetNodeIds: targetNodeIds.length > 0 ? targetNodeIds : fallbackNodeIds,
      });
    }

    return validated;
  }
}
