import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../db/prisma.service';
import { GeminiRunnerService } from '../../llm/gemini-runner.service';
import { GeminiService } from '../../llm/gemini.service';
import { QUEUE_NAMES } from '../queues/queue.names';

type GraphHints = {
  typeByPath?: Record<string, 'DIR' | 'FILE' | 'MODULE' | 'SERVICE' | 'CONFIG'>;
  labelByPath?: Record<string, string>;
};

@Injectable()
export class BuildGraphWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BuildGraphWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly geminiRunner: GeminiRunnerService,
  ) { }

  async onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.BUILD_GRAPH,
      async (job: Job) => this.handle(job),
      {
        connection: { host: 'localhost', port: 6379 },
      },
    );
    this.logger.log(`BuildGraphWorker listening on queue: ${QUEUE_NAMES.BUILD_GRAPH}`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async handle(job: Job) {
    const { projectId, repoSnapshotId, traceId } = job.data;

    this.logger.log(`[traceId=${traceId}] [step=BUILD_GRAPH] start project=${projectId} snapshot=${repoSnapshotId}`);

    const snapshot = await this.prisma.repoSnapshot.findUnique({ where: { id: repoSnapshotId } });
    if (!snapshot) {
      throw new Error(`RepoSnapshot not found: ${repoSnapshotId}`);
    }

    const repoRoot = snapshot.sandboxRepoPath;

    const hintsAttr = await this.geminiRunner.runWithGeminiFirst<GraphHints>({
      stepName: 'BUILD_GRAPH',
      traceId,
      projectId,
      geminiFn: async () => this.getGraphHintsWithGemini(repoRoot),
      fallbackFn: async () => ({ typeByPath: {}, labelByPath: {} }),
    });

    const hints = hintsAttr.value;

    const graph = await this.prisma.graphSnapshot.create({
      data: {
        projectId,
        repoSnapshotId,
      },
    });

    const projectNode = await this.prisma.node.create({
      data: {
        graphSnapshotId: graph.id,
        type: 'PROJECT',
        label: path.basename(repoRoot),
        path: '/',
      },
    });

    let nodeCount = 1;
    let edgeCount = 0;

    const nodesToCreate: any[] = [];
    const edgesToCreate: any[] = [];

    const walk = async (dirPath: string, parentNodeId: string, currentPath: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.name === '.git' ||
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === '.next' ||
          entry.name === '.venv' ||
          entry.name === 'target' ||
          entry.name === 'vendor' ||
          entry.name === 'out' ||
          entry.name === '__pycache__'
        )
          continue;

        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.relative(repoRoot, fullPath);
        const nodeId = crypto.randomUUID();

        if (entry.isDirectory()) {
          const hintType = hints.typeByPath?.[relPath];
          const nodeType = hintType && ['DIR', 'MODULE', 'SERVICE', 'CONFIG'].includes(hintType) ? hintType : 'DIR';

          nodesToCreate.push({
            id: nodeId,
            graphSnapshotId: graph.id,
            type: nodeType as any,
            label: hints.labelByPath?.[relPath] || entry.name,
            path: relPath,
          });

          edgesToCreate.push({
            graphSnapshotId: graph.id,
            type: 'CONTAINS',
            fromNodeId: parentNodeId,
            toNodeId: nodeId,
          });

          await walk(fullPath, nodeId, relPath);
        } else if (entry.isFile()) {
          const hintType = hints.typeByPath?.[relPath];
          const nodeType = hintType && ['FILE', 'MODULE', 'SERVICE', 'CONFIG'].includes(hintType) ? hintType : 'FILE';

          nodesToCreate.push({
            id: nodeId,
            graphSnapshotId: graph.id,
            type: nodeType as any,
            label: hints.labelByPath?.[relPath] || entry.name,
            path: relPath,
          });

          edgesToCreate.push({
            graphSnapshotId: graph.id,
            type: 'CONTAINS',
            fromNodeId: parentNodeId,
            toNodeId: nodeId,
          });
        }
      }
    };

    const crypto = require('crypto');
    await walk(repoRoot, projectNode.id, '');

    // Batch creation
    if (nodesToCreate.length > 0) {
      this.logger.log(`[traceId=${traceId}] batch creating ${nodesToCreate.length} nodes...`);
      await this.prisma.node.createMany({ data: nodesToCreate });
    }
    if (edgesToCreate.length > 0) {
      this.logger.log(`[traceId=${traceId}] batch creating ${edgesToCreate.length} edges...`);
      await this.prisma.edge.createMany({ data: edgesToCreate });
    }

    const totalNodes = nodesToCreate.length + 1;
    const totalEdges = edgesToCreate.length;

    await this.prisma.graphSnapshot.update({
      where: { id: graph.id },
      data: {
        nodeCount: totalNodes,
        edgeCount: totalEdges,
      },
    });

    this.logger.log(
      `[traceId=${traceId}] [step=BUILD_GRAPH] done [source=${hintsAttr.source}] model=${hintsAttr.model ?? 'n/a'} latencyMs=${hintsAttr.latencyMs} graphSnapshotId=${graph.id} nodes=${totalNodes} edges=${totalEdges}`,
    );

    return { graphSnapshotId: graph.id, nodeCount: totalNodes, edgeCount: totalEdges };
  }

  private async getGraphHintsWithGemini(repoRoot: string): Promise<GraphHints> {
    this.gemini.assertConfigured();

    const paths: string[] = [];
    const walk = (dir: string, depth: number) => {
      if (depth <= 0) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true }).slice(0, 150)) {
        if (e.name === '.git' || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        const rel = path.relative(repoRoot, full);
        paths.push(rel + (e.isDirectory() ? '/' : ''));
        if (e.isDirectory()) walk(full, depth - 1);
      }
    };
    walk(repoRoot, 3);

    const hints = await this.gemini.generateJson<GraphHints>(
      [
        'Classify repository paths into graph node types.',
        'Return JSON: {"typeByPath": {"path": "DIR|FILE|MODULE|SERVICE|CONFIG"}, "labelByPath": {"path": "label"}}',
        'Only include keys for paths provided.',
      ].join('\n'),
      JSON.stringify({ paths: paths.slice(0, 500) }).slice(0, 12_000),
      18_000,
    );

    if (!hints || typeof hints !== 'object') {
      throw new Error('Gemini graph hints invalid');
    }

    return {
      typeByPath: hints.typeByPath ?? {},
      labelByPath: hints.labelByPath ?? {},
    };
  }
}
