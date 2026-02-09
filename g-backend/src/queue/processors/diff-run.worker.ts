import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../db/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { QUEUE_NAMES } from '../queues/queue.names';
import { NodeType, EdgeType } from '@prisma/client';
import { AuditService } from '../../modules/governance/audit.service';
import { GeminiService } from '../../llm/gemini.service';
import { GeminiRunnerService } from '../../llm/gemini-runner.service';

type DiffJob = { runId: string; traceId?: string };

type NodeKey = string; // `${type}:${path}`
type EdgeKey = string; // `${type}:${fromPath}->${toPath}`

@Injectable()
export class DiffRunWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DiffRunWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly gemini: GeminiService,
    private readonly geminiRunner: GeminiRunnerService,
  ) {}

  async onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.DIFF_RUN,
      async (job: Job<DiffJob>) => {
        const { runId, traceId } = job.data;
        this.logger.log(`[traceId=${traceId}] [step=DIFF] start run=${runId}`);

        const run = await this.prisma.run.findUnique({ where: { id: runId } });
        if (!run) throw new Error(`Run not found: ${runId}`);
        await this.audit.log({
          projectId: run.projectId,
          traceId,
          actorRole: 'system',
          action: 'worker.diff.start',
          entityType: 'Run',
          entityId: runId,
          decision: 'ALLOW',
        });

        const existingDiff = await this.prisma.diffReport.findUnique({
          where: { runId },
          select: { id: true, reportPath: true },
        });
        if (existingDiff) {
          this.logger.log(`[traceId=${traceId}] diff skip run=${runId} reason=report-exists`);
          return { ok: true, runId, reportPath: existingDiff.reportPath, skipped: true };
        }

        const verification = await this.prisma.verificationReport.findUnique({ where: { runId } });
        if (!verification) throw new Error(`VerificationReport not found for run=${runId} (Stage 6 required)`);
        if (verification.projectId !== run.projectId) {
          await this.audit.log({
            projectId: run.projectId,
            traceId,
            actorRole: 'system',
            action: 'worker.diff.scope',
            entityType: 'VerificationReport',
            entityId: verification.id,
            decision: 'DENY',
            meta: { reason: 'verification project mismatch' },
          });
          throw new Error(`Cross-project scope mismatch for verification run=${runId}`);
        }

        // BEFORE graph: latest graph snapshot for this repoSnapshot
        const beforeGraph = await this.prisma.graphSnapshot.findFirst({
          where: { repoSnapshotId: run.repoSnapshotId, projectId: run.projectId },
          orderBy: { createdAt: 'desc' },
        });
        if (!beforeGraph) throw new Error(`Before GraphSnapshot not found for repoSnapshot=${run.repoSnapshotId}`);

        // AFTER graph: from verification report
        const afterGraph = await this.prisma.graphSnapshot.findUnique({
          where: { id: verification.graphSnapshotId },
        });
        if (!afterGraph) throw new Error(`After GraphSnapshot not found id=${verification.graphSnapshotId}`);
        if (afterGraph.projectId !== run.projectId || beforeGraph.projectId !== run.projectId) {
          await this.audit.log({
            projectId: run.projectId,
            traceId,
            actorRole: 'system',
            action: 'worker.diff.scope',
            entityType: 'GraphSnapshot',
            entityId: verification.graphSnapshotId,
            decision: 'DENY',
            meta: { reason: 'graph project mismatch' },
          });
          throw new Error(`Cross-project scope mismatch for run=${runId}`);
        }

        const [beforeNodes, afterNodes, beforeEdges, afterEdges] = await Promise.all([
          this.prisma.node.findMany({ where: { graphSnapshotId: beforeGraph.id } }),
          this.prisma.node.findMany({ where: { graphSnapshotId: afterGraph.id } }),
          this.prisma.edge.findMany({ where: { graphSnapshotId: beforeGraph.id } }),
          this.prisma.edge.findMany({ where: { graphSnapshotId: afterGraph.id } }),
        ]);

        // Map nodeId -> path for each graph (edge translation)
        const beforeIdToPath = new Map<string, string>();
        for (const n of beforeNodes) beforeIdToPath.set(n.id, n.path ?? n.label);

        const afterIdToPath = new Map<string, string>();
        for (const n of afterNodes) afterIdToPath.set(n.id, n.path ?? n.label);

        const nodeKey = (type: NodeType, p?: string | null, label?: string) =>
          `${type}:${(p ?? label ?? '').trim()}`;

        const beforeNodeSet = new Set<NodeKey>(beforeNodes.map(n => nodeKey(n.type, n.path, n.label)));
        const afterNodeSet = new Set<NodeKey>(afterNodes.map(n => nodeKey(n.type, n.path, n.label)));

        const nodesAdded = [...afterNodeSet].filter(k => !beforeNodeSet.has(k));
        const nodesRemoved = [...beforeNodeSet].filter(k => !afterNodeSet.has(k));

        const edgeKey = (type: EdgeType, fromPath: string, toPath: string) =>
          `${type}:${fromPath}->${toPath}`;

        const beforeEdgeSet = new Set<EdgeKey>(
          beforeEdges.map(e => edgeKey(
            e.type,
            beforeIdToPath.get(e.fromNodeId) ?? e.fromNodeId,
            beforeIdToPath.get(e.toNodeId) ?? e.toNodeId,
          )),
        );

        const afterEdgeSet = new Set<EdgeKey>(
          afterEdges.map(e => edgeKey(
            e.type,
            afterIdToPath.get(e.fromNodeId) ?? e.fromNodeId,
            afterIdToPath.get(e.toNodeId) ?? e.toNodeId,
          )),
        );

        const edgesAdded = [...afterEdgeSet].filter(k => !beforeEdgeSet.has(k));
        const edgesRemoved = [...beforeEdgeSet].filter(k => !afterEdgeSet.has(k));

        const [beforeRiskCount, afterRiskCount] = await Promise.all([
          this.prisma.risk.count({ where: { projectId: run.projectId, graphSnapshotId: beforeGraph.id } }),
          this.prisma.risk.count({ where: { projectId: run.projectId, graphSnapshotId: afterGraph.id } }),
        ]);

        const riskDelta = afterRiskCount - beforeRiskCount;

        const narrativeAttr = await this.geminiRunner.runWithGeminiFirst<{ narrative: string }>({
          stepName: 'DIFF',
          traceId,
          projectId: run.projectId,
          runId,
          geminiFn: async () => {
            this.gemini.assertConfigured();
            const narrative = await this.gemini.generateText(
              [
                'Write a concise semantic diff narrative.',
                'Mention major code graph and risk changes in 2-4 sentences.',
              ].join('\n'),
              JSON.stringify({
                nodesAdded: nodesAdded.length,
                nodesRemoved: nodesRemoved.length,
                edgesAdded: edgesAdded.length,
                edgesRemoved: edgesRemoved.length,
                beforeRiskCount,
                afterRiskCount,
                riskDelta,
              }),
              16_000,
            );
            if (!narrative) throw new Error('Gemini narrative unavailable');
            return { narrative: narrative.slice(0, 1_000) };
          },
          fallbackFn: async () => ({
            narrative: `Semantic diff generated. nodes(+${nodesAdded.length}/-${nodesRemoved.length}), edges(+${edgesAdded.length}/-${edgesRemoved.length}), riskDelta=${riskDelta}.`,
          }),
        });

        const report = {
          runId,
          projectId: run.projectId,
          before: {
            graphSnapshotId: beforeGraph.id,
            nodeCount: beforeNodes.length,
            edgeCount: beforeEdges.length,
            riskCount: beforeRiskCount,
          },
          after: {
            graphSnapshotId: afterGraph.id,
            nodeCount: afterNodes.length,
            edgeCount: afterEdges.length,
            riskCount: afterRiskCount,
          },
          deltas: {
            nodesAddedCount: nodesAdded.length,
            nodesRemovedCount: nodesRemoved.length,
            edgesAddedCount: edgesAdded.length,
            edgesRemovedCount: edgesRemoved.length,
            riskDelta,
          },
          samples: {
            nodesAdded: nodesAdded.slice(0, 25),
            nodesRemoved: nodesRemoved.slice(0, 25),
            edgesAdded: edgesAdded.slice(0, 25),
            edgesRemoved: edgesRemoved.slice(0, 25),
          },
          narrative: narrativeAttr.value.narrative,
          generatedAt: new Date().toISOString(),
        };

        const reportPath = this.storage.writeJson(
          run.projectId,
          run.id,
          'diff/semantic-diff.json',
          report,
        );

        await this.prisma.diffReport.upsert({
          where: { runId },
          create: {
            runId,
            projectId: run.projectId,
            beforeGraphSnapshotId: beforeGraph.id,
            afterGraphSnapshotId: afterGraph.id,
            nodesAddedCount: nodesAdded.length,
            nodesRemovedCount: nodesRemoved.length,
            edgesAddedCount: edgesAdded.length,
            edgesRemovedCount: edgesRemoved.length,
            beforeRiskCount,
            afterRiskCount,
            riskDelta,
            reportPath,
          },
          update: {
            beforeGraphSnapshotId: beforeGraph.id,
            afterGraphSnapshotId: afterGraph.id,
            nodesAddedCount: nodesAdded.length,
            nodesRemovedCount: nodesRemoved.length,
            edgesAddedCount: edgesAdded.length,
            edgesRemovedCount: edgesRemoved.length,
            beforeRiskCount,
            afterRiskCount,
            riskDelta,
            reportPath,
          },
        });

        this.logger.log(
          `[traceId=${traceId}] [step=DIFF] done [source=${narrativeAttr.source}] model=${narrativeAttr.model ?? 'n/a'} latencyMs=${narrativeAttr.latencyMs} run=${runId} nodes(+${nodesAdded.length}/-${nodesRemoved.length}) edges(+${edgesAdded.length}/-${edgesRemoved.length}) riskDelta=${riskDelta}`,
        );
        await this.audit.log({
          projectId: run.projectId,
          traceId,
          actorRole: 'system',
          action: 'worker.diff.done',
          entityType: 'Run',
          entityId: runId,
          decision: 'ALLOW',
          meta: { riskDelta, source: narrativeAttr.source, latencyMs: narrativeAttr.latencyMs },
        });

        // Stage 8 chaining: finalize NodeAction for this run (if one exists)
        try {
          const updated = await this.prisma.nodeAction.updateMany({
            where: { runId },
            data: { status: 'SUCCEEDED', error: null },
          });
          if (updated.count > 0) {
            this.logger.log(`[traceId=${traceId}] nodeAction finalized run=${runId} status=SUCCEEDED`);
          }
        } catch (e: any) {
          // Don't fail the diff if node actions aren't being used in this run
          this.logger.warn(
            `[traceId=${traceId}] nodeAction finalize skipped run=${runId}: ${e?.message ?? e}`,
          );
        }

        return { ok: true, runId, reportPath };
      },
      { connection: { host: 'localhost', port: 6379 } },
    );

    this.logger.log(`DiffRunWorker listening on queue: ${QUEUE_NAMES.DIFF_RUN}`);

    this.worker.on('failed', async (job, err) => {
      const runId = (job?.data as any)?.runId;
      const traceId = (job?.data as any)?.traceId;

      this.logger.error(
        `[traceId=${traceId}] DIFF_RUN failed jobId=${job?.id} run=${runId}`,
        err.stack,
      );

      if (!runId) return;

      try {
        const run = await this.prisma.run.findUnique({ where: { id: runId }, select: { projectId: true } });
        if (run) {
          await this.audit.log({
            projectId: run.projectId,
            traceId,
            actorRole: 'system',
            action: 'worker.diff.failed',
            entityType: 'Run',
            entityId: runId,
            decision: 'DENY',
            meta: { error: err?.message ?? String(err) },
          });
        }
        await this.prisma.nodeAction.updateMany({
          where: { runId },
          data: { status: 'FAILED', error: err?.message ?? String(err) },
        });
      } catch (e: any) {
        this.logger.warn(
          `[traceId=${traceId}] nodeAction fail-update skipped run=${runId}: ${e?.message ?? e}`,
        );
      }
    });
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }
}
