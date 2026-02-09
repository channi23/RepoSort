import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../db/prisma.service';
import { GeminiRunnerService } from '../../llm/gemini-runner.service';
import { GeminiService } from '../../llm/gemini.service';
import { QUEUE_NAMES } from '../queues/queue.names';

type RiskInput = {
  type: 'STRUCTURAL' | 'SECURITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  ruleId: string;
  meta?: any;
  nodeIds: string[];
};

@Injectable()
export class AnalyzeRepoWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyzeRepoWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly geminiRunner: GeminiRunnerService,
  ) { }

  async onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.ANALYZE_REPO,
      async (job: Job) => this.handle(job),
      { connection: { host: 'localhost', port: 6379 } },
    );
    this.logger.log(`AnalyzeRepoWorker listening on queue: ${QUEUE_NAMES.ANALYZE_REPO}`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async handle(job: Job) {
    const { projectId, graphSnapshotId, traceId } = job.data;

    this.logger.log(`[traceId=${traceId}] [step=ANALYZE] start project=${projectId} graph=${graphSnapshotId}`);

    const graph = await this.prisma.graphSnapshot.findUnique({ where: { id: graphSnapshotId } });
    if (!graph) throw new Error(`GraphSnapshot not found: ${graphSnapshotId}`);

    const repoSnap = await this.prisma.repoSnapshot.findUnique({ where: { id: graph.repoSnapshotId } });
    if (!repoSnap) throw new Error(`RepoSnapshot not found: ${graph.repoSnapshotId}`);

    const repoRoot = repoSnap.sandboxRepoPath;

    const nodes = await this.prisma.node.findMany({ where: { graphSnapshotId } });
    const pathToNodeId = new Map<string, string>();
    for (const n of nodes) {
      if (n.path) pathToNodeId.set(n.path, n.id);
      if (n.path === '/') pathToNodeId.set('/', n.id);
    }

    const riskAttr = await this.geminiRunner.runWithGeminiFirst<RiskInput[]>({
      stepName: 'ANALYZE',
      traceId,
      projectId,
      geminiFn: async () => this.getRisksWithGemini(repoRoot, nodes, pathToNodeId),
      fallbackFn: async () => this.getFallbackRisks(repoRoot, nodes, pathToNodeId),
    });

    await this.prisma.risk.deleteMany({ where: { graphSnapshotId } });

    for (const r of riskAttr.value) {
      const created = await this.prisma.risk.create({
        data: {
          projectId,
          graphSnapshotId,
          type: r.type,
          severity: r.severity,
          title: r.title,
          description: r.description,
          ruleId: r.ruleId,
          meta: r.meta ?? undefined,
          nodes: {
            create: r.nodeIds.map((nodeId) => ({ nodeId })),
          },
        },
      });
      this.logger.log(`[traceId=${traceId}] [step=ANALYZE] risk created id=${created.id} rule=${r.ruleId}`);
    }

    this.logger.log(
      `[traceId=${traceId}] [step=ANALYZE] done [source=${riskAttr.source}] model=${riskAttr.model ?? 'n/a'} latencyMs=${riskAttr.latencyMs} graph=${graphSnapshotId} risks=${riskAttr.value.length}`,
    );
    return { riskCount: riskAttr.value.length };
  }

  private async getRisksWithGemini(
    repoRoot: string,
    nodes: Array<{ id: string; path: string | null; type: any }>,
    pathToNodeId: Map<string, string>,
  ): Promise<RiskInput[]> {
    this.gemini.assertConfigured();

    const importantPaths = nodes
      .filter((n) => n.path && /package\.json|Dockerfile|docker-compose|\.env|src\//i.test(n.path))
      .map((n) => n.path as string)
      .slice(0, 120);

    const rootEntries = fs.readdirSync(repoRoot).slice(0, 120);

    const geminiRisks = await this.gemini.generateJson<
      Array<{
        type: 'STRUCTURAL' | 'SECURITY';
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        title: string;
        description: string;
        ruleId: string;
        path?: string;
      }>
    >(
      [
        'Find high-value engineering risks from repository metadata.',
        'Return JSON array only with keys: type,severity,title,description,ruleId,path(optional).',
        'Keep <= 12 risks and concise descriptions.',
      ].join('\n'),
      JSON.stringify({ rootEntries, importantPaths }).slice(0, 12_000),
      18_000,
    );

    if (!Array.isArray(geminiRisks) || geminiRisks.length === 0) {
      throw new Error('Gemini returned no analyzable risks');
    }

    const mapped: RiskInput[] = [];
    for (const r of geminiRisks.slice(0, 12)) {
      if (!r?.type || !r?.severity || !r?.title || !r?.description || !r?.ruleId) continue;
      const nodeId = r.path ? pathToNodeId.get(r.path) : pathToNodeId.get('/');
      if (!nodeId) continue;
      mapped.push({
        type: r.type,
        severity: r.severity,
        title: String(r.title).slice(0, 180),
        description: String(r.description).slice(0, 1000),
        ruleId: String(r.ruleId).slice(0, 100),
        nodeIds: [nodeId],
        meta: r.path ? { path: r.path } : undefined,
      });
    }

    if (mapped.length === 0) {
      throw new Error('Gemini risks could not be mapped to graph nodes');
    }

    return mapped;
  }

  private async getFallbackRisks(
    repoRoot: string,
    nodes: Array<{ id: string; path: string | null; type: any }>,
    pathToNodeId: Map<string, string>,
  ): Promise<RiskInput[]> {
    const risksToCreate: RiskInput[] = [];

    const rootEntries = fs
      .readdirSync(repoRoot, { withFileTypes: true })
      .filter((e) => e.name !== '.git' && e.name !== 'node_modules');
    if (rootEntries.length > 40) {
      const rootNode = pathToNodeId.get('/');
      if (rootNode) {
        risksToCreate.push({
          type: 'STRUCTURAL',
          severity: 'MEDIUM',
          title: 'High root-level sprawl',
          description: `Repo root contains ${rootEntries.length} entries. Consider grouping into packages/modules.`,
          ruleId: 'STRUCT_ROOT_SPRAWL',
          nodeIds: [rootNode],
          meta: { count: rootEntries.length },
        });
      }
    }

    const largeFiles: Array<{ rel: string; size: number }> = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (
          e.name === '.git' ||
          e.name === 'node_modules' ||
          e.name === 'dist' ||
          e.name === 'build' ||
          e.name === '.next' ||
          e.name === '.venv' ||
          e.name === 'target' ||
          e.name === 'vendor' ||
          e.name === 'out' ||
          e.name === '__pycache__'
        )
          continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        if (e.isFile()) {
          const st = fs.statSync(full);
          if (st.size > 300_000) {
            largeFiles.push({ rel: path.relative(repoRoot, full), size: st.size });
          }
        }
      }
    };
    walk(repoRoot);

    for (const lf of largeFiles.slice(0, 10)) {
      const nodeId = pathToNodeId.get(lf.rel);
      if (!nodeId) continue;
      risksToCreate.push({
        type: 'STRUCTURAL',
        severity: 'LOW',
        title: 'Large file detected',
        description: `File "${lf.rel}" is ${(lf.size / 1024).toFixed(0)}KB. Consider splitting or excluding generated artifacts.`,
        ruleId: 'STRUCT_LARGE_FILE',
        nodeIds: [nodeId],
        meta: { path: lf.rel, bytes: lf.size },
      });
    }

    const secretRegex = /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/i;
    const likelyFiles = nodes
      .filter((n) => n.type === 'FILE' && n.path && /\.(env|js|ts|json|yml|yaml)$/i.test(n.path))
      .map((n) => n.path!)
      .slice(0, 300);

    for (const rel of likelyFiles) {
      const full = path.join(repoRoot, rel);
      if (!fs.existsSync(full)) continue;
      try {
        const txt = fs.readFileSync(full, 'utf8');
        const m = txt.match(secretRegex);
        if (m) {
          const nodeId = pathToNodeId.get(rel);
          if (!nodeId) continue;
          risksToCreate.push({
            type: 'SECURITY',
            severity: 'HIGH',
            title: 'Possible hardcoded secret',
            description: `Potential secret pattern found in "${rel}". Move to env/secret manager.`,
            ruleId: 'SEC_HARDCODED_SECRET',
            nodeIds: [nodeId],
            meta: { match: m[0].slice(0, 80) },
          });
        }
      } catch { }
    }

    return risksToCreate;
  }
}
