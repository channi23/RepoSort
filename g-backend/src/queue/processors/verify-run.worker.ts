import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_NAMES } from '../queues/queue.names';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { StorageService } from '../../storage/storage.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AuditService } from '../../modules/governance/audit.service';
import { GeminiService } from '../../llm/gemini.service';
import { GeminiRunnerService } from '../../llm/gemini-runner.service';

// Import Prisma enums so TS matches your schema types
import { NodeType, EdgeType, RiskType, RiskSeverity } from '@prisma/client';

type VerifyJob = { runId: string; traceId?: string };

@Injectable()
export class VerifyRunWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VerifyRunWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly gemini: GeminiService,
    private readonly geminiRunner: GeminiRunnerService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    const queues = this.moduleRef.get(QUEUE_REGISTRY, { strict: false });
    if (!queues?.diff) {
      throw new Error('QUEUE_REGISTRY.diff is not available. Ensure QueueModule provides { diff: makeQueue(QUEUE_NAMES.DIFF_RUN) }.');
    }
    this.worker = new Worker(
      QUEUE_NAMES.VERIFY_RUN,
      async (job: Job<VerifyJob>) => {
        const { runId, traceId } = job.data;

        this.logger.log(`[traceId=${traceId}] [step=VERIFY] start run=${runId}`);

        // 0) Load run
        const run = await this.prisma.run.findUnique({
          where: { id: runId },
          include: { patch: true },
        });
        if (!run) throw new Error(`Run not found: ${runId}`);
        if (!run.sandboxRepoPath) throw new Error(`Run sandboxRepoPath missing: ${runId}`);

        const projectId = run.projectId;
        const repoRoot = run.sandboxRepoPath;
        await this.audit.log({
          projectId,
          traceId,
          actorRole: 'system',
          action: 'worker.verify.start',
          entityType: 'Run',
          entityId: runId,
          decision: 'ALLOW',
        });

        // 1) Build minimal graph from run repo (typed with Prisma enums)
        const nodes: { id: string; type: NodeType; label: string; path?: string; meta?: any }[] = [];
        const edges: { id: string; type: EdgeType; fromNodeId: string; toNodeId: string; meta?: any }[] = [];

        const makeId = () => crypto.randomUUID();
        const projectNodeId = makeId();

        nodes.push({
          id: projectNodeId,
          type: NodeType.PROJECT,
          label: path.basename(repoRoot),
          path: '',
        });

        const walk = (dir: string, parentNodeId: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const ent of entries) {
            const full = path.join(dir, ent.name);
            const rel = path.relative(repoRoot, full);

            if (ent.isDirectory()) {
              const dirId = makeId();
              nodes.push({ id: dirId, type: NodeType.DIR, label: ent.name, path: rel });
              edges.push({ id: makeId(), type: EdgeType.CONTAINS, fromNodeId: parentNodeId, toNodeId: dirId });
              walk(full, dirId);
            } else if (ent.isFile()) {
              const fileId = makeId();
              nodes.push({ id: fileId, type: NodeType.FILE, label: ent.name, path: rel });
              edges.push({ id: makeId(), type: EdgeType.CONTAINS, fromNodeId: parentNodeId, toNodeId: fileId });
            }
          }
        };

        walk(repoRoot, projectNodeId);

        // 2) Store GraphSnapshot
        const graph = await this.prisma.graphSnapshot.create({
          data: {
            projectId,
            repoSnapshotId: run.repoSnapshotId,
            nodeCount: nodes.length,
            edgeCount: edges.length,
          },
        });

        await this.prisma.node.createMany({
          data: nodes.map((n) => ({
            id: n.id,
            graphSnapshotId: graph.id,
            type: n.type,            // ✅ NodeType enum
            label: n.label,
            path: n.path ?? undefined,
            meta: n.meta ?? undefined,
          })),
        });

        await this.prisma.edge.createMany({
          data: edges.map((e) => ({
            id: e.id,
            graphSnapshotId: graph.id,
            type: e.type,            // ✅ EdgeType enum
            fromNodeId: e.fromNodeId,
            toNodeId: e.toNodeId,
            meta: e.meta ?? undefined,
          })),
        });

        // 3) Basic scanners
        const risksToCreate: Array<{
          type: RiskType;
          severity: RiskSeverity;
          title: string;
          description: string;
          ruleId: string;
          meta?: any;
          nodeIds: string[];
        }> = [];

        // Large file scanner
        for (const n of nodes.filter((x) => x.type === NodeType.FILE && x.path)) {
          const full = path.join(repoRoot, n.path!);
          try {
            const st = fs.statSync(full);
            if (st.size >= 300_000) {
              risksToCreate.push({
                type: RiskType.STRUCTURAL,
                severity: RiskSeverity.LOW,
                title: 'Large file detected',
                description: `File "${n.path}" is ${Math.round(st.size / 1024)}KB.`,
                ruleId: 'STRUCT_LARGE_FILE',
                meta: { path: n.path, bytes: st.size },
                nodeIds: [n.id],
              });
            }
          } catch {}
        }

        // .env scanner
        const envNode = nodes.find((n) => n.type === NodeType.FILE && n.label === '.env');
        if (envNode) {
          risksToCreate.push({
            type: RiskType.SECURITY,
            severity: RiskSeverity.MEDIUM,
            title: '.env file present',
            description: '.env file detected. Ensure secrets are not committed.',
            ruleId: 'SEC_ENV_PRESENT',
            meta: { path: envNode.path },
            nodeIds: [envNode.id],
          });
        }

        // Unsafe exec scanner
        const execPatterns = ['child_process.exec(', 'child_process.execSync(', 'eval('];
        for (const n of nodes.filter((x) => x.type === NodeType.FILE && x.path?.match(/\.(ts|js)$/))) {
          try {
            const content = fs.readFileSync(path.join(repoRoot, n.path!), 'utf-8');
            if (execPatterns.some((p) => content.includes(p))) {
              risksToCreate.push({
                type: RiskType.SECURITY,
                severity: RiskSeverity.LOW,
                title: 'Potential unsafe execution',
                description: `File "${n.path}" may execute commands dynamically.`,
                ruleId: 'SEC_POTENTIAL_UNSAFE_EXEC',
                meta: { path: n.path },
                nodeIds: [n.id],
              });
            }
          } catch {}
        }

        // 4) Persist risks
        const createdRiskIds: string[] = [];

        for (const r of risksToCreate) {
          const risk = await this.prisma.risk.create({
            data: {
              projectId,
              graphSnapshotId: graph.id,
              type: r.type,              // ✅ RiskType enum
              severity: r.severity,      // ✅ RiskSeverity enum
              title: r.title,
              description: r.description,
              ruleId: r.ruleId,
              meta: r.meta ?? undefined,
            },
          });

          createdRiskIds.push(risk.id);

          await this.prisma.riskOnNode.createMany({
            data: r.nodeIds.map((nodeId) => ({ riskId: risk.id, nodeId })),
          });

          this.logger.log(`[traceId=${traceId}] risk created id=${risk.id} rule=${r.ruleId}`);
        }

        // 5) Confidence heuristic
        const residualRiskCount = createdRiskIds.length;
        const confidence = Math.max(0, Math.min(1, 1 - residualRiskCount * 0.08));

        // 6) Patch summary
        const patchPath = run.patch?.path;
        const patchBytes = patchPath && fs.existsSync(patchPath) ? fs.statSync(patchPath).size : 0;

        const summaryAttr = await this.geminiRunner.runWithGeminiFirst<{
          whatChanged: string;
          why: string;
          whatRemainsUnsafe: string;
        }>({
          stepName: 'VERIFY',
          traceId,
          projectId,
          runId,
          geminiFn: async () => {
            this.gemini.assertConfigured();
            const summary = await this.gemini.generateJson<{
              whatChanged?: string;
              why?: string;
              whatRemainsUnsafe?: string;
            }>(
              [
                'Write a concise verification narrative.',
                'Return JSON: {whatChanged, why, whatRemainsUnsafe}.',
              ].join('\n'),
              JSON.stringify({
                runId,
                patchBytes,
                residualRiskCount,
                confidence,
                risks: risksToCreate.slice(0, 10).map((r) => ({ title: r.title, severity: r.severity })),
              }),
              16_000,
            );
            if (!summary?.whatChanged || !summary?.why || !summary?.whatRemainsUnsafe) {
              throw new Error('Gemini verification narrative invalid');
            }
            return {
              whatChanged: String(summary.whatChanged).slice(0, 500),
              why: String(summary.why).slice(0, 500),
              whatRemainsUnsafe: String(summary.whatRemainsUnsafe).slice(0, 500),
            };
          },
          fallbackFn: async () => ({
            whatChanged: patchBytes > 0 ? 'Code changes detected.' : 'No code changes detected.',
            why: 'Verification rebuilt graph and re-ran scanners.',
            whatRemainsUnsafe: residualRiskCount > 0 ? 'Residual risks remain.' : 'No residual risks detected.',
          }),
        });

        const report = {
          runId,
          projectId,
          repoSnapshotId: run.repoSnapshotId,
          graphSnapshotId: graph.id,
          residualRiskCount,
          confidence,
          patch: { path: patchPath ?? null, bytes: patchBytes },
          summary: summaryAttr.value,
          generatedAt: new Date().toISOString(),
        };

        const reportPath = this.storage.writeJson(projectId, run.id, 'verification/report.json', report);

        await this.prisma.verificationReport.upsert({
          where: { runId },
          create: {
            runId,
            projectId,
            graphSnapshotId: graph.id,
            confidence,
            residualRiskCount,
            reportPath,
          },
          update: {
            graphSnapshotId: graph.id,
            confidence,
            residualRiskCount,
            reportPath,
          },
        });

        const existingDiff = await this.prisma.diffReport.findUnique({
          where: { runId },
          select: { id: true },
        });
        if (existingDiff) {
          this.logger.log(`[traceId=${traceId}] DIFF_RUN enqueue skipped run=${runId} reason=report-exists`);
          this.logger.log(
            `[traceId=${traceId}] [step=VERIFY] done [source=${summaryAttr.source}] model=${summaryAttr.model ?? 'n/a'} latencyMs=${summaryAttr.latencyMs} run=${runId} graph=${graph.id} risks=${residualRiskCount} confidence=${confidence}`,
          );
          return { ok: true, runId, graphSnapshotId: graph.id, residualRiskCount, confidence, skippedDiff: true };
        }

        const diffJob = await queues.diff.add(QUEUE_NAMES.DIFF_RUN, { runId, traceId });
        this.logger.log(`[traceId=${traceId}] DIFF_RUN auto-enqueued jobId=${diffJob.id} run=${runId}`);

        this.logger.log(
          `[traceId=${traceId}] [step=VERIFY] done [source=${summaryAttr.source}] model=${summaryAttr.model ?? 'n/a'} latencyMs=${summaryAttr.latencyMs} run=${runId} graph=${graph.id} risks=${residualRiskCount} confidence=${confidence}`,
        );
        await this.audit.log({
          projectId,
          traceId,
          actorRole: 'system',
          action: 'worker.verify.done',
          entityType: 'Run',
          entityId: runId,
          decision: 'ALLOW',
          meta: { residualRiskCount, confidence, source: summaryAttr.source, latencyMs: summaryAttr.latencyMs },
        });

        return { ok: true, runId, graphSnapshotId: graph.id, residualRiskCount, confidence };
      },
      { connection: { host: 'localhost', port: 6379 } },
    );

    this.worker.on('failed', async (job, err) => {
      const runId = (job?.data as any)?.runId;
      const traceId = (job?.data as any)?.traceId;
      if (!runId) return;

      const run = await this.prisma.run.findUnique({
        where: { id: runId },
        select: { projectId: true },
      });
      if (!run) return;

      await this.audit.log({
        projectId: run.projectId,
        traceId,
        actorRole: 'system',
        action: 'worker.verify.failed',
        entityType: 'Run',
        entityId: runId,
        decision: 'DENY',
        meta: { error: err?.message ?? String(err) },
      });
    });

    this.logger.log(`VerifyRunWorker listening on queue: ${QUEUE_NAMES.VERIFY_RUN}`);
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }
}
