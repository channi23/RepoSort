import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import * as fs from 'fs';
import { PrismaService } from '../../db/prisma.service';
import { GeminiRunnerService } from '../../llm/gemini-runner.service';
import { GeminiService } from '../../llm/gemini.service';
import { AuditService } from '../../modules/governance/audit.service';
import { SandboxService } from '../../sandbox/sandbox.service';
import { StorageService } from '../../storage/storage.service';
import { QUEUE_NAMES } from '../queues/queue.names';

type ExportJob = {
  projectId: string;
  runId: string;
  traceId?: string;
};

@Injectable()
export class ExportArtifactsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExportArtifactsWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly sandbox: SandboxService,
    private readonly audit: AuditService,
    private readonly gemini: GeminiService,
    private readonly geminiRunner: GeminiRunnerService,
  ) {}

  async onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.EXPORT_ARTIFACTS,
      async (job: Job<ExportJob>) => {
        const { projectId, runId, traceId } = job.data;
        this.logger.log(`[traceId=${traceId}] [step=EXPORT] start run=${runId}`);

        await this.audit.log({
          projectId,
          traceId,
          actorRole: 'system',
          action: 'worker.export.start',
          entityType: 'Run',
          entityId: runId,
          decision: 'ALLOW',
        });

        const run = await this.prisma.run.findUnique({
          where: { id: runId },
          include: { patch: true, verification: true, diffReport: true },
        });
        if (!run) throw new Error(`Run not found: ${runId}`);
        if (run.projectId !== projectId) throw new Error(`Run project mismatch for export run=${runId}`);

        const graph = run.verification
          ? await this.prisma.graphSnapshot.findUnique({ where: { id: run.verification.graphSnapshotId } })
          : await this.prisma.graphSnapshot.findFirst({
              where: { projectId, repoSnapshotId: run.repoSnapshotId },
              orderBy: { createdAt: 'desc' },
            });

        const nodes = graph
          ? await this.prisma.node.findMany({ where: { graphSnapshotId: graph.id }, select: { path: true } })
          : [];
        const dirCount = new Map<string, number>();
        for (const n of nodes) {
          const p = n.path ?? '';
          if (!p) continue;
          const top = p.split('/')[0] || '(root)';
          dirCount.set(top, (dirCount.get(top) ?? 0) + 1);
        }
        const topDirectories = [...dirCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([dir, count]) => ({ dir, count }));

        const architectureMap = {
          projectId,
          runId,
          graphSnapshotId: graph?.id ?? null,
          nodeCount: graph?.nodeCount ?? 0,
          edgeCount: graph?.edgeCount ?? 0,
          topDirectories,
          generatedAt: new Date().toISOString(),
        };

        const latestRisks = graph
          ? await this.prisma.risk.findMany({
              where: { projectId, graphSnapshotId: graph.id },
              orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
              select: { id: true, type: true, severity: true, title: true, description: true, ruleId: true },
            })
          : [];

        const riskRegister = {
          projectId,
          runId,
          graphSnapshotId: graph?.id ?? null,
          risks: latestRisks,
          generatedAt: new Date().toISOString(),
        };

        const patchBytes = run.patch?.path && fs.existsSync(run.patch.path) ? fs.statSync(run.patch.path).size : 0;
        const runSummary = {
          projectId,
          runId,
          status: run.status,
          patch: {
            path: run.patch?.path ?? null,
            bytes: patchBytes,
          },
          verification: run.verification
            ? {
                confidence: run.verification.confidence,
                residualRiskCount: run.verification.residualRiskCount,
              }
            : null,
          diff: run.diffReport
            ? {
                nodesAddedCount: run.diffReport.nodesAddedCount,
                nodesRemovedCount: run.diffReport.nodesRemovedCount,
                edgesAddedCount: run.diffReport.edgesAddedCount,
                edgesRemovedCount: run.diffReport.edgesRemovedCount,
                riskDelta: run.diffReport.riskDelta,
              }
            : null,
          generatedAt: new Date().toISOString(),
        };

        const commandLogs = await this.prisma.auditLog.findMany({
          where: { projectId, action: 'sandbox.command' },
          orderBy: { createdAt: 'asc' },
          take: 200,
        });

        const approvals = await this.prisma.approvalRequest.findMany({
          where: {
            projectId,
            OR: [{ runId }, { planId: run.planId }],
          },
          orderBy: { createdAt: 'asc' },
        });

        const docAttr = await this.geminiRunner.runWithGeminiFirst<{ complianceMd: string; prInstructions: string }>({
          stepName: 'EXPORT',
          traceId,
          projectId,
          runId,
          geminiFn: async () => {
            this.gemini.assertConfigured();
            const docs = await this.gemini.generateJson<{ complianceMd?: string; prInstructions?: string }>(
              [
                'Generate concise export docs.',
                'Return JSON with keys: complianceMd, prInstructions.',
                'Use markdown. Avoid secrets.',
              ].join('\n'),
              JSON.stringify({
                projectId,
                runId,
                commandList: commandLogs.map((log) => (log.meta as any)?.command ?? 'unknown').slice(0, 50),
                approvals: approvals.map((a) => ({ id: a.id, status: a.status })),
                allowlist: this.sandbox.getAllowedCommands(),
              }).slice(0, 12_000),
              16_000,
            );
            if (!docs?.complianceMd || !docs?.prInstructions) {
              throw new Error('Gemini export docs invalid');
            }
            return {
              complianceMd: String(docs.complianceMd).slice(0, 8_000),
              prInstructions: String(docs.prInstructions).slice(0, 4_000),
            };
          },
          fallbackFn: async () => ({
            complianceMd: [
              '# Compliance Summary',
              '',
              `- projectId: ${projectId}`,
              `- runId: ${runId}`,
              `- generatedAt: ${new Date().toISOString()}`,
              '',
              '## Commands Executed',
              ...(
                commandLogs.length
                  ? commandLogs.map((log) => `- ${(log.meta as any)?.command ?? 'unknown'}`)
                  : ['- none logged']
              ),
              '',
              '## Sandbox Allowlist',
              ...this.sandbox.getAllowedCommands().map((cmd) => `- ${cmd}`),
              '',
              '## Approvals',
              ...(approvals.length
                ? approvals.map(
                    (a) =>
                      `- ${a.id}: ${a.status} (planId=${a.planId ?? 'n/a'}, runId=${a.runId ?? 'n/a'}, decidedBy=${a.decidedByRole ?? 'n/a'})`,
                  )
                : ['- none']),
              '',
            ].join('\n'),
            prInstructions: [
              '# PR Instructions',
              '',
              '1. Apply patch file: `git apply artifacts/<projectId>/<runId>/patch.diff`',
              '2. Run local checks (`npm run build`, `npm test`) inside the repo clone.',
              '3. Commit with a clear message describing the plan and run ID.',
              '4. Push branch and open a pull request with run summary and verification output.',
              '',
            ].join('\n'),
          }),
        });

        this.storage.writeJson(projectId, runId, 'export/architecture-map.json', architectureMap);
        this.storage.writeJson(projectId, runId, 'export/risk-register.json', riskRegister);
        this.storage.writeJson(projectId, runId, 'export/run-summary.json', runSummary);
        this.storage.writeText(projectId, runId, 'export/compliance.md', docAttr.value.complianceMd);
        this.storage.writeText(projectId, runId, 'export/pr_instructions.md', docAttr.value.prInstructions);

        await this.audit.log({
          projectId,
          traceId,
          actorRole: 'system',
          action: 'worker.export.done',
          entityType: 'Run',
          entityId: runId,
          decision: 'ALLOW',
          meta: { files: 5, source: docAttr.source, latencyMs: docAttr.latencyMs },
        });

        this.logger.log(
          `[traceId=${traceId}] [step=EXPORT] done [source=${docAttr.source}] model=${docAttr.model ?? 'n/a'} latencyMs=${docAttr.latencyMs} run=${runId}`,
        );
        return { ok: true, runId };
      },
      { connection: { host: 'localhost', port: 6379 } },
    );

    this.worker.on('failed', async (job, err) => {
      const runId = (job?.data as any)?.runId;
      const projectId = (job?.data as any)?.projectId;
      const traceId = (job?.data as any)?.traceId;

      this.logger.error(`[traceId=${traceId}] EXPORT_ARTIFACTS failed run=${runId}`, err.stack);

      if (projectId && runId) {
        await this.audit.log({
          projectId,
          traceId,
          actorRole: 'system',
          action: 'worker.export.failed',
          entityType: 'Run',
          entityId: runId,
          decision: 'DENY',
          meta: { error: err?.message ?? String(err) },
        });
      }
    });

    this.logger.log(`ExportArtifactsWorker listening on queue: ${QUEUE_NAMES.EXPORT_ARTIFACTS}`);
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }
}
