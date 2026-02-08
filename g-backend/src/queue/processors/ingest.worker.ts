import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../queues/queue.names';
import { PrismaService } from '../../db/prisma.service';
import { SandboxService } from '../../sandbox/sandbox.service';
import * as fs from 'fs';
import * as path from 'path';

//this file code is typed by AI

@Injectable()
export class IngestWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sandbox: SandboxService,
  ) {}

  async onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.INGEST_REPO,
      async (job: Job) => {
        const { projectId, traceId } = job.data as any;
        this.logger.log(`[traceId=${traceId}] ingest start projectId=${projectId}`);

        const project = await this.prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new Error(`Project not found: ${projectId}`);


        const snapshot = await this.prisma.repoSnapshot.create({
          data: {
            projectId,
            sandboxRepoPath: 'pending',
          },
        });

        const repoDir = this.sandbox.ensureRepoDir(projectId, snapshot.id);

        // clone
        const cloneRes = await this.sandbox.runCommand({
          cwd: path.dirname(repoDir),
          cmd: 'git',
          args: ['clone', project.repoUrl, 'repo', '--depth', '1'],
          timeoutMs: 5 * 60_000,
        });

        if (cloneRes.exitCode !== 0) {
          this.logger.error(`[traceId=${traceId}] git clone failed: ${cloneRes.stderr}`);
          throw new Error(`git clone failed: ${cloneRes.stderr}`);
        }

        // detect branch + commit
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

        // basic detection helpers
        const exists = (p: string) => fs.existsSync(path.join(repoDir, p));

        const packageManager =
          exists('pnpm-lock.yaml') ? 'pnpm' :
          exists('yarn.lock') ? 'yarn' :
          exists('package-lock.json') ? 'npm' :
          exists('bun.lockb') ? 'bun' :
          null;

        const isMonorepo =
          exists('pnpm-workspace.yaml') ||
          exists('lerna.json') ||
          exists('turbo.json') ||
          (exists('package.json') && (() => {
            try {
              const pkg = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf-8'));
              return Boolean(pkg.workspaces);
            } catch { return false; }
          })());

        // test framework guess (very minimal)
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

        // file tree (lightweight, depth-limited)
        const walk = (dir: string, depth: number): any => {
          if (depth <= 0) return [];
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          return entries.slice(0, 200).map((e) => {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) return { name: e.name, type: 'dir', children: walk(full, depth - 1) };
            return { name: e.name, type: 'file' };
          });
        };
        const fileTreeJson = walk(repoDir, 3);

        const configJson = {
          hasEnvExample: exists('.env.example'),
          hasDockerfile: exists('Dockerfile'),
          hasCompose: exists('docker-compose.yml'),
          hasNest: exists('nest-cli.json'),
        };

        // update snapshot
        await this.prisma.repoSnapshot.update({
          where: { id: snapshot.id },
          data: {
            sandboxRepoPath: repoDir,
            branch,
            commitSha,
            isMonorepo,
            packageManager,
            runtime: exists('package.json') ? 'node' : null,
            testFramework,
            fileTreeJson,
            configJson,
          },
        });

        this.logger.log(`[traceId=${traceId}] ingest done snapshotId=${snapshot.id}`);
        return { snapshotId: snapshot.id };
      },
      { connection: { host: 'localhost', port: 6379 } },
    );

    this.logger.log(`IngestWorker listening on queue: ${QUEUE_NAMES.INGEST_REPO}`);
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }
}
