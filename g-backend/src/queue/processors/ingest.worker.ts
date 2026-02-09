import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../db/prisma.service';
import { GeminiRunnerService } from '../../llm/gemini-runner.service';
import { GeminiService } from '../../llm/gemini.service';
import { SandboxService } from '../../sandbox/sandbox.service';
import { QUEUE_NAMES } from '../queues/queue.names';

type IngestMetadata = {
  packageManager: string | null;
  runtime: string | null;
  testFramework: string | null;
  isMonorepo: boolean;
  summary?: string;
};

@Injectable()
export class IngestWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sandbox: SandboxService,
    private readonly gemini: GeminiService,
    private readonly geminiRunner: GeminiRunnerService,
  ) {}

  async onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.INGEST_REPO,
      async (job: Job) => {
        const { projectId, traceId } = job.data as any;
        this.logger.log(`[traceId=${traceId}] [step=INGEST] start projectId=${projectId}`);

        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new Error(`Project not found: ${projectId}`);

        const snapshot = await this.prisma.repoSnapshot.create({
          data: {
            projectId,
            sandboxRepoPath: 'pending',
          },
        });

        const repoDir = this.sandbox.ensureRepoDir(projectId, snapshot.id);

        const cloneRes = await this.sandbox.runCommand({
          cwd: path.dirname(repoDir),
          cmd: 'git',
          args: ['clone', project.repoUrl, 'repo', '--depth', '1'],
          timeoutMs: 5 * 60_000,
        });

        if (cloneRes.exitCode !== 0) {
          this.logger.error(`[traceId=${traceId}] [step=INGEST] clone failed: ${cloneRes.stderr}`);
          throw new Error(`git clone failed: ${cloneRes.stderr}`);
        }

        const branchRes = await this.sandbox.runCommand({
          cwd: repoDir,
          cmd: 'git',
          args: ['rev-parse', '--abbrev-ref', 'HEAD'],
          timeoutMs: 30_000,
        });

        const commitRes = await this.sandbox.runCommand({
          cwd: repoDir,
          cmd: 'git',
          args: ['rev-parse', 'HEAD'],
          timeoutMs: 30_000,
        });

        const branch = branchRes.stdout?.trim() || null;
        const commitSha = commitRes.stdout?.trim() || null;

        const fileTreeJson = this.buildFileTree(repoDir, 3);

        const attribution = await this.geminiRunner.runWithGeminiFirst<IngestMetadata>({
          stepName: 'INGEST',
          traceId,
          projectId,
          geminiFn: async () => {
            const metadata = await this.detectWithGemini(repoDir, fileTreeJson);
            return metadata;
          },
          fallbackFn: async () => this.detectWithFallback(repoDir),
        });

        const configJson = {
          hasEnvExample: fs.existsSync(path.join(repoDir, '.env.example')),
          hasDockerfile: fs.existsSync(path.join(repoDir, 'Dockerfile')),
          hasCompose: fs.existsSync(path.join(repoDir, 'docker-compose.yml')),
          hasNest: fs.existsSync(path.join(repoDir, 'nest-cli.json')),
          ingestSummary: attribution.value.summary ?? null,
        };

        await this.prisma.repoSnapshot.update({
          where: { id: snapshot.id },
          data: {
            sandboxRepoPath: repoDir,
            branch,
            commitSha,
            isMonorepo: attribution.value.isMonorepo,
            packageManager: attribution.value.packageManager,
            runtime: attribution.value.runtime,
            testFramework: attribution.value.testFramework,
            fileTreeJson,
            configJson,
          },
        });

        this.logger.log(
          `[traceId=${traceId}] [step=INGEST] done [source=${attribution.source}] model=${attribution.model ?? 'n/a'} latencyMs=${attribution.latencyMs} snapshotId=${snapshot.id}`,
        );

        return { snapshotId: snapshot.id };
      },
      { connection: { host: 'localhost', port: 6379 } },
    );

    this.logger.log(`IngestWorker listening on queue: ${QUEUE_NAMES.INGEST_REPO}`);
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }

  private buildFileTree(repoDir: string, depth: number): any {
    const walk = (dir: string, remaining: number): any => {
      if (remaining <= 0) return [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      return entries.slice(0, 200).map((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return { name: e.name, type: 'dir', children: walk(full, remaining - 1) };
        return { name: e.name, type: 'file' };
      });
    };
    return walk(repoDir, depth);
  }

  private async detectWithGemini(repoDir: string, fileTreeJson: any): Promise<IngestMetadata> {
    this.gemini.assertConfigured();
    const rootEntries = fs.readdirSync(repoDir).slice(0, 120);
    const response = await this.gemini.generateJson<IngestMetadata>(
      [
        'Classify repository metadata for CI ingestion.',
        'Return JSON exactly with keys: packageManager, runtime, testFramework, isMonorepo, summary.',
        'Allowed packageManager: npm|yarn|pnpm|bun|null.',
        'Allowed runtime: node|python|go|java|dotnet|unknown|null.',
      ].join('\n'),
      JSON.stringify({ rootEntries, fileTree: fileTreeJson }).slice(0, 12_000),
      18_000,
    );

    if (!response || typeof response.isMonorepo !== 'boolean') {
      throw new Error('Gemini returned invalid ingest metadata');
    }

    return {
      packageManager: response.packageManager ?? null,
      runtime: response.runtime ?? null,
      testFramework: response.testFramework ?? null,
      isMonorepo: Boolean(response.isMonorepo),
      summary: response.summary ? String(response.summary).slice(0, 500) : undefined,
    };
  }

  private async detectWithFallback(repoDir: string): Promise<IngestMetadata> {
    const exists = (p: string) => fs.existsSync(path.join(repoDir, p));

    const packageManager =
      exists('pnpm-lock.yaml')
        ? 'pnpm'
        : exists('yarn.lock')
          ? 'yarn'
          : exists('package-lock.json')
            ? 'npm'
            : exists('bun.lockb')
              ? 'bun'
              : null;

    const isMonorepo =
      exists('pnpm-workspace.yaml') ||
      exists('lerna.json') ||
      exists('turbo.json') ||
      (exists('package.json') &&
        (() => {
          try {
            const pkg = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf-8'));
            return Boolean(pkg.workspaces);
          } catch {
            return false;
          }
        })());

    let testFramework: string | null = null;
    if (exists('package.json')) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf-8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (deps.vitest) testFramework = 'vitest';
        else if (deps.jest) testFramework = 'jest';
        else if (deps.mocha) testFramework = 'mocha';
        else if (pkg.scripts?.test) testFramework = 'npm-script';
      } catch {}
    }

    return {
      packageManager,
      runtime: exists('package.json') ? 'node' : null,
      testFramework,
      isMonorepo,
      summary: 'Fallback heuristic metadata detection',
    };
  }
}
