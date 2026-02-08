import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_NAMES } from '../queues/queue.names';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AnalyzeRepoWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyzeRepoWorker.name);
  private worker!: Worker;

  constructor(private readonly prisma: PrismaService) {}

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

    this.logger.log(`[traceId=${traceId}] analyze start project=${projectId} graph=${graphSnapshotId}`);

    const graph = await this.prisma.graphSnapshot.findUnique({ where: { id: graphSnapshotId } });
    if (!graph) throw new Error(`GraphSnapshot not found: ${graphSnapshotId}`);

    // Find repoSnapshot -> sandboxRepoPath
    const repoSnap = await this.prisma.repoSnapshot.findUnique({ where: { id: graph.repoSnapshotId } });
    if (!repoSnap) throw new Error(`RepoSnapshot not found: ${graph.repoSnapshotId}`);

    const repoRoot = repoSnap.sandboxRepoPath;

    // Load nodes for mapping path->nodeId
    const nodes = await this.prisma.node.findMany({ where: { graphSnapshotId } });
    const pathToNodeId = new Map<string, string>();
    for (const n of nodes) {
      if (n.path) pathToNodeId.set(n.path, n.id);
      if (n.path === '/') pathToNodeId.set('/', n.id);
    }

    const risksToCreate: Array<{
      type: 'STRUCTURAL' | 'SECURITY';
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      title: string;
      description: string;
      ruleId: string;
      meta?: any;
      nodeIds: string[];
    }> = [];

    // ---------- MVP Structural scanner ----------
    // Heuristic 1: Too many files under root
    const rootEntries = fs.readdirSync(repoRoot, { withFileTypes: true })
      .filter(e => e.name !== '.git' && e.name !== 'node_modules');
    if (rootEntries.length > 40) {
      risksToCreate.push({
        type: 'STRUCTURAL',
        severity: 'MEDIUM',
        title: 'High root-level sprawl',
        description: `Repo root contains ${rootEntries.length} entries. Consider grouping into packages/modules.`,
        ruleId: 'STRUCT_ROOT_SPRAWL',
        nodeIds: [pathToNodeId.get('/')!].filter(Boolean),
        meta: { count: rootEntries.length },
      });
    }

    // Heuristic 2: Very large file (> 300KB) – often generated/minified/bundled
    const largeFiles: Array<{ rel: string; size: number }> = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '.git' || e.name === 'node_modules') continue;
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

    // ---------- MVP Security scanner ----------
    // Heuristic: secret-like strings in common files (basic regex)
    const secretRegex = /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/i;
    const scanTextFile = (fullPath: string, rel: string) => {
      const txt = fs.readFileSync(fullPath, 'utf8');
      const m = txt.match(secretRegex);
      if (m) {
        const nodeId = pathToNodeId.get(rel);
        if (!nodeId) return;
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
    };

    // only scan a small set of likely files for MVP
    const likelyFiles = nodes
      .filter(n => n.type === 'FILE' && n.path && /\.(env|js|ts|json|yml|yaml)$/i.test(n.path))
      .map(n => n.path!)
      .slice(0, 300); // MVP cap

    for (const rel of likelyFiles) {
      const full = path.join(repoRoot, rel);
      if (!fs.existsSync(full)) continue;
      try { scanTextFile(full, rel); } catch { /* ignore binary/encoding */ }
    }

    // Clear old risks for this graph snapshot (idempotent re-run)
    await this.prisma.risk.deleteMany({ where: { graphSnapshotId } });

    // Create risks + link to nodes
    for (const r of risksToCreate) {
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
            create: r.nodeIds.map(nodeId => ({ nodeId })),
          },
        },
      });
      this.logger.log(`[traceId=${traceId}] risk created id=${created.id} rule=${r.ruleId} nodes=${r.nodeIds.length}`);
    }

    this.logger.log(`[traceId=${traceId}] analyze done graph=${graphSnapshotId} risks=${risksToCreate.length}`);
    return { riskCount: risksToCreate.length };
  }
}
