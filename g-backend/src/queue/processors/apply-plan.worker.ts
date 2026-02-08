import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_NAMES } from '../queues/queue.names';
import { SandboxService } from '../../sandbox/sandbox.service';
import { StorageService } from '../../storage/storage.service';

type ApplyPlanJob = {
  runId: string;
  projectId: string;
  repoSnapshotId: string;
  planId: string;
  traceId?: string;
};

@Injectable()
export class ApplyPlanWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApplyPlanWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sandbox: SandboxService,
    private readonly storage: StorageService,
  ) {}

  async onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.APPLY_PLAN,
      async (job: Job<ApplyPlanJob>) => {
        const { runId, projectId, repoSnapshotId, planId, traceId } = job.data;

        this.logger.log(`[traceId=${traceId}] apply plan start run=${runId}`);

        await this.prisma.run.update({
          where: { id: runId },
          data: { status: 'RUNNING', startedAt: new Date() },
        });

        // 1) load snapshot + plan
        const [snapshot, plan, steps] = await Promise.all([
          this.prisma.repoSnapshot.findUnique({ where: { id: repoSnapshotId } }),
          this.prisma.plan.findUnique({ where: { id: planId } }),
          this.prisma.planStep.findMany({ where: { planId }, orderBy: { order: 'asc' } }),
        ]);

        if (!snapshot) throw new Error(`RepoSnapshot not found: ${repoSnapshotId}`);
        if (!plan) throw new Error(`Plan not found: ${planId}`);

        // 2) create run repo from snapshot repo
        const runRepoPath = this.sandbox.getRepoPath(projectId, runId);
        this.sandbox.ensureDir(runRepoPath);

        // snapshot.sandboxRepoPath is the cloned repo path from Stage 1
        this.sandbox.copyDir(snapshot.sandboxRepoPath, runRepoPath);

        // 3) apply deterministic edits (MVP)
        // We keep this safe: only write into repo, no arbitrary commands.
        // Example: create a "PLAN.md" + add a TODO file.
        const planMdPath = require('path').join(runRepoPath, 'GEMINI_PLAN.md');
        const fs = require('fs');

        const planMd = [
          `# Gemini Plan`,
          ``,
          `Prompt: ${plan.prompt}`,
          ``,
          `Steps:`,
          ...steps.map((s) => `- [${s.type}] ${s.title}`),
          ``,
        ].join('\n');

        fs.writeFileSync(planMdPath, planMd, 'utf-8');

        // Optional: if step says ADD_TESTS, drop a placeholder
        if (steps.some((s) => s.type === 'ADD_TESTS')) {
          const testsNote = require('path').join(runRepoPath, 'GEMINI_TESTS_TODO.md');
          fs.writeFileSync(testsNote, `Add tests for selected nodes.\n`, 'utf-8');
        }

        // 4) run install/build/test (best-effort)
        // You may need to detect package manager later; for MVP assume npm if package.json exists.
        const hasPkgJson = fs.existsSync(require('path').join(runRepoPath, 'package.json'));

        let install = { stdout: '', stderr: '', exitCode: 0, timedOut: false };
        let build = { stdout: '', stderr: '', exitCode: 0, timedOut: false };
        let test = { stdout: '', stderr: '', exitCode: 0, timedOut: false };

        if (hasPkgJson) {
          install = await this.sandbox.runCommand({ cwd: runRepoPath, cmd: 'npm', args: ['ci'], timeoutMs: 10 * 60_000 });
          // build is optional; if script missing, npm will non-zero → you can skip later
          build = await this.sandbox.runCommand({ cwd: runRepoPath, cmd: 'npm', args: ['run', 'build'], timeoutMs: 10 * 60_000 });
          test = await this.sandbox.runCommand({ cwd: runRepoPath, cmd: 'npm', args: ['test'], timeoutMs: 10 * 60_000 });
        } else {
          this.logger.warn(`[traceId=${traceId}] no package.json found, skipping install/build/test`);
        }

        // 5) generate patch.diff (git diff)
        // init git if needed (copied repo likely already has .git from clone)
        const diffRes = await this.sandbox.runCommand({ cwd: runRepoPath, cmd: 'git', args: ['diff'], timeoutMs: 60_000 });
        const patchText = diffRes.stdout || '';

        const patchPath = this.storage.writeText(projectId, runId, 'patch.diff', patchText);

        // 6) persist patch row + run results
        await this.prisma.patch.upsert({
          where: { runId },
          create: { runId, path: patchPath },
          update: { path: patchPath },
        });

        const succeeded =
          (!hasPkgJson) ||
          (install.exitCode === 0 && build.exitCode === 0 && test.exitCode === 0);

        await this.prisma.run.update({
          where: { id: runId },
          data: {
            status: succeeded ? 'SUCCEEDED' : 'FAILED',
            finishedAt: new Date(),
            sandboxRepoPath: runRepoPath,

            installOk: hasPkgJson ? install.exitCode === 0 : null,
            buildOk: hasPkgJson ? build.exitCode === 0 : null,
            testOk: hasPkgJson ? test.exitCode === 0 : null,

            installStdout: install.stdout,
            installStderr: install.stderr,
            buildStdout: build.stdout,
            buildStderr: build.stderr,
            testStdout: test.stdout,
            testStderr: test.stderr,
          },
        });

        this.logger.log(
          `[traceId=${traceId}] apply plan done run=${runId} status=${succeeded ? 'SUCCEEDED' : 'FAILED'} patch=${patchText.length}B`,
        );

        return { ok: true, runId, succeeded };
      },
      { connection: { host: 'localhost', port: 6379 } },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `[traceId=${(job?.data as any)?.traceId}] APPLY_PLAN failed jobId=${job?.id}`,
        err.stack,
      );
    });

    this.logger.log(`ApplyPlanWorker listening on queue: ${QUEUE_NAMES.APPLY_PLAN}`);
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }
}
