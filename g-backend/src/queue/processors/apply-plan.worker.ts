import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Job, Worker } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../db/prisma.service';
import { GeminiRunnerService } from '../../llm/gemini-runner.service';
import { GeminiService } from '../../llm/gemini.service';
import { AuditService } from '../../modules/governance/audit.service';
import { PolicyService } from '../../modules/governance/policy.service';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { SandboxService } from '../../sandbox/sandbox.service';
import { StorageService } from '../../storage/storage.service';
import { QUEUE_NAMES } from '../queues/queue.names';

type ApplyPlanJob = {
  runId: string;
  projectId?: string;
  repoSnapshotId?: string;
  planId?: string;
  traceId?: string;
};

type PatchInstruction = {
  path: string;
  op: 'replace' | 'insert' | 'delete';
  anchor: string;
  content?: string;
};

const DISALLOWED_FILE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip', '.gz', '.pdf']);

@Injectable()
export class ApplyPlanWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApplyPlanWorker.name);
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sandbox: SandboxService,
    private readonly storage: StorageService,
    private readonly gemini: GeminiService,
    private readonly geminiRunner: GeminiRunnerService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    const queues = this.moduleRef.get(QUEUE_REGISTRY, { strict: false });

    this.worker = new Worker(
      QUEUE_NAMES.APPLY_PLAN,
      async (job: Job<ApplyPlanJob>) => {
        const { runId, traceId } = job.data;

        let projectIdForAudit = 'unknown';

        try {
          this.logger.log(`[traceId=${traceId}] [step=APPLY_PLAN] start run=${runId}`);

          const run = await this.prisma.run.findUnique({
            where: { id: runId },
            select: { projectId: true, repoSnapshotId: true, planId: true },
          });
          if (!run) throw new Error(`Run not found: ${runId}`);

          const { projectId, repoSnapshotId, planId } = run;
          projectIdForAudit = projectId;

          await this.audit.log({
            projectId,
            traceId,
            actorRole: 'system',
            action: 'worker.apply-plan.start',
            entityType: 'Run',
            entityId: runId,
            decision: 'ALLOW',
          });

          await this.prisma.run.update({
            where: { id: runId },
            data: { status: 'RUNNING', startedAt: new Date() },
          });

          const [snapshot, plan, steps] = await Promise.all([
            this.prisma.repoSnapshot.findUnique({ where: { id: repoSnapshotId } }),
            this.prisma.plan.findUnique({ where: { id: planId } }),
            this.prisma.planStep.findMany({ where: { planId }, orderBy: { order: 'asc' } }),
          ]);

          if (!snapshot) throw new Error(`RepoSnapshot not found: ${repoSnapshotId}`);
          if (!plan) throw new Error(`Plan not found: ${planId}`);

          if (snapshot.projectId !== projectId || plan.projectId !== projectId) {
            await this.audit.log({
              projectId,
              traceId,
              actorRole: 'system',
              action: 'worker.apply-plan.scope',
              entityType: 'Run',
              entityId: runId,
              decision: 'DENY',
              meta: { reason: 'repoSnapshot/plan project mismatch' },
            });
            throw new Error(`Cross-project scope mismatch for run=${runId}`);
          }

          const linkedAction = await this.prisma.nodeAction.findFirst({ where: { runId } });
          if (linkedAction) {
            if (
              linkedAction.projectId !== projectId ||
              linkedAction.repoSnapshotId !== repoSnapshotId ||
              linkedAction.planId !== planId
            ) {
              await this.audit.log({
                projectId,
                traceId,
                actorRole: 'system',
                action: 'worker.apply-plan.scope',
                entityType: 'NodeAction',
                entityId: linkedAction.id,
                decision: 'DENY',
                meta: { reason: 'nodeAction linkage mismatch' },
              });
              throw new Error(`Cross-project scope mismatch for nodeAction=${linkedAction.id}`);
            }
          }

          const runRepoPath = this.sandbox.getRepoPath(projectId, runId);
          this.sandbox.ensureDir(runRepoPath);
          this.sandbox.copyDir(snapshot.sandboxRepoPath, runRepoPath);

          const patchInstructionsAttr = await this.geminiRunner.runWithGeminiFirst<PatchInstruction[]>({
            stepName: 'APPLY_PLAN',
            traceId,
            projectId,
            runId,
            nodeActionId: linkedAction?.id,
            geminiFn: async () => {
              this.gemini.assertConfigured();
              const modelInstructions = await this.gemini.generateJson<PatchInstruction[]>(
                [
                  'You produce safe deterministic edit instructions for a TypeScript/JavaScript repo.',
                  'Output a JSON array only.',
                  'Schema: [{"path":"relative/path.ts","op":"replace|insert|delete","anchor":"exact string","content":"new string"}]',
                  'Do not include absolute paths, markdown, or shell commands.',
                ].join('\n'),
                JSON.stringify({
                  prompt: plan.prompt,
                  planSteps: steps.map((s) => ({ type: s.type, title: s.title, rationale: s.rationale })),
                }).slice(0, 15_000),
                18_000,
              );
              if (!Array.isArray(modelInstructions)) {
                throw new Error('Gemini did not return patch instruction array');
              }
              return modelInstructions;
            },
            fallbackFn: async () => [],
          });

          const appliedCount = this.applyPatchInstructions(runRepoPath, patchInstructionsAttr.value);

          if (appliedCount === 0) {
            const planMdPath = path.join(runRepoPath, 'GEMINI_PLAN.md');
            const planMd = [
              '# Gemini Plan',
              '',
              `Prompt: ${plan.prompt}`,
              '',
              'Steps:',
              ...steps.map((s) => `- [${s.type}] ${s.title}`),
              '',
            ].join('\n');
            fs.writeFileSync(planMdPath, planMd, 'utf-8');

            if (steps.some((s) => s.type === 'ADD_TESTS')) {
              const testsNote = path.join(runRepoPath, 'GEMINI_TESTS_TODO.md');
              fs.writeFileSync(testsNote, 'Add tests for selected nodes.\n', 'utf-8');
            }
          }

          const hasPkgJson = fs.existsSync(path.join(runRepoPath, 'package.json'));

          let install = { stdout: '', stderr: '', exitCode: 0, timedOut: false };
          let build = { stdout: '', stderr: '', exitCode: 0, timedOut: false };
          let test = { stdout: '', stderr: '', exitCode: 0, timedOut: false };

          if (hasPkgJson) {
            const cmdDecision = this.policy.evaluateAction({
              actionType: 'SANDBOX_COMMAND',
              projectId,
              command: 'npm',
            });
            await this.audit.log({
              projectId,
              traceId,
              actorRole: 'system',
              action: 'sandbox.command',
              entityType: 'Run',
              entityId: runId,
              decision: cmdDecision.decision,
              meta: { command: 'npm' },
            });
            if (cmdDecision.decision === 'DENY') {
              throw new Error(cmdDecision.reasons.join('; '));
            }

            install = await this.sandbox.runCommand({ cwd: runRepoPath, cmd: 'npm', args: ['ci'], timeoutMs: 10 * 60_000 });
            build = await this.sandbox.runCommand({ cwd: runRepoPath, cmd: 'npm', args: ['run', 'build'], timeoutMs: 10 * 60_000 });
            test = await this.sandbox.runCommand({ cwd: runRepoPath, cmd: 'npm', args: ['test'], timeoutMs: 10 * 60_000 });
          } else {
            this.logger.warn(`[traceId=${traceId}] no package.json found, skipping install/build/test`);
          }

          const gitDecision = this.policy.evaluateAction({
            actionType: 'SANDBOX_COMMAND',
            projectId,
            command: 'git',
          });
          await this.audit.log({
            projectId,
            traceId,
            actorRole: 'system',
            action: 'sandbox.command',
            entityType: 'Run',
            entityId: runId,
            decision: gitDecision.decision,
            meta: { command: 'git' },
          });
          if (gitDecision.decision === 'DENY') {
            throw new Error(gitDecision.reasons.join('; '));
          }

          const diffRes = await this.sandbox.runCommand({ cwd: runRepoPath, cmd: 'git', args: ['diff'], timeoutMs: 60_000 });
          const patchText = diffRes.stdout || '';

          const patchPath = this.storage.writeText(projectId, runId, 'patch.diff', patchText);

          await this.prisma.patch.upsert({
            where: { runId },
            create: { runId, path: patchPath },
            update: { path: patchPath },
          });

          const succeeded = !hasPkgJson || (install.exitCode === 0 && build.exitCode === 0 && test.exitCode === 0);

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
            `[traceId=${traceId}] [step=APPLY_PLAN] done [source=${patchInstructionsAttr.source}] model=${patchInstructionsAttr.model ?? 'n/a'} latencyMs=${patchInstructionsAttr.latencyMs} run=${runId} status=${succeeded ? 'SUCCEEDED' : 'FAILED'} patch=${patchText.length}B`,
          );

          await this.audit.log({
            projectId,
            traceId,
            actorRole: 'system',
            action: 'worker.apply-plan.done',
            entityType: 'Run',
            entityId: runId,
            decision: succeeded ? 'ALLOW' : 'DENY',
            meta: { patchBytes: patchText.length, appliedInstructions: appliedCount, source: patchInstructionsAttr.source, latencyMs: patchInstructionsAttr.latencyMs },
          });

          if (!succeeded) {
            throw new Error(`APPLY_PLAN checks failed for run=${runId}`);
          }

          const existingVerification = await this.prisma.verificationReport.findUnique({
            where: { runId },
            select: { id: true },
          });
          if (existingVerification) {
            this.logger.log(`[traceId=${traceId}] VERIFY_RUN enqueue skipped run=${runId} reason=report-exists`);
            return { ok: true, runId, succeeded, skippedVerify: true };
          }

          const verifyJob = await queues.verify.add(QUEUE_NAMES.VERIFY_RUN, { runId, traceId });
          this.logger.log(`[traceId=${traceId}] VERIFY_RUN auto-enqueued jobId=${verifyJob.id} run=${runId}`);

          return { ok: true, runId, succeeded };
        } catch (error: any) {
          const message = error?.message ?? String(error);
          const now = new Date();

          await this.prisma.run.updateMany({
            where: { id: runId },
            data: { status: 'FAILED', finishedAt: now },
          });

          await this.prisma.nodeAction.updateMany({
            where: { runId },
            data: { status: 'FAILED', error: message },
          });

          if (projectIdForAudit !== 'unknown') {
            await this.audit.log({
              projectId: projectIdForAudit,
              traceId,
              actorRole: 'system',
              action: 'worker.apply-plan.failed',
              entityType: 'Run',
              entityId: runId,
              decision: 'DENY',
              meta: { error: message },
            });
          }

          throw error;
        }
      },
      { connection: { host: 'localhost', port: 6379 } },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`[traceId=${(job?.data as any)?.traceId}] APPLY_PLAN failed jobId=${job?.id}`, err.stack);
    });

    this.logger.log(`ApplyPlanWorker listening on queue: ${QUEUE_NAMES.APPLY_PLAN}`);
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
  }

  private applyPatchInstructions(repoRoot: string, instructions: PatchInstruction[]) {
    if (!Array.isArray(instructions) || instructions.length === 0) return 0;

    const sanitized = instructions
      .map((raw) => ({
        path: String(raw?.path ?? ''),
        op: raw?.op,
        anchor: String(raw?.anchor ?? ''),
        content: typeof raw?.content === 'string' ? raw.content : '',
      }))
      .filter((i) =>
        Boolean(i.path && (i.op === 'replace' || i.op === 'insert' || i.op === 'delete') && i.anchor),
      )
      .map((i) => i as PatchInstruction)
      .slice(0, 10);

    const touchedFiles = new Set<string>();
    let applied = 0;

    for (const instruction of sanitized) {
      if (touchedFiles.size >= 10 && !touchedFiles.has(instruction.path)) break;

      const fullPath = path.resolve(repoRoot, instruction.path);
      if (!fullPath.startsWith(path.resolve(repoRoot) + path.sep)) {
        continue;
      }

      const ext = path.extname(fullPath).toLowerCase();
      if (DISALLOWED_FILE_EXTENSIONS.has(ext)) {
        continue;
      }

      const exists = fs.existsSync(fullPath);
      if (!exists && instruction.op !== 'insert') {
        continue;
      }

      const original = exists ? fs.readFileSync(fullPath, 'utf-8') : '';
      if (!original.includes(instruction.anchor) && instruction.op !== 'insert') {
        continue;
      }

      let next = original;
      if (instruction.op === 'replace') {
        next = original.replace(instruction.anchor, instruction.content ?? '');
      } else if (instruction.op === 'insert') {
        if (!exists) {
          next = `${instruction.content ?? ''}\n`;
        } else if (original.includes(instruction.anchor)) {
          next = original.replace(instruction.anchor, `${instruction.anchor}\n${instruction.content ?? ''}`);
        } else {
          continue;
        }
      } else {
        next = original.replace(instruction.anchor, '');
      }

      if (next === original) {
        continue;
      }

      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, next, 'utf-8');
      touchedFiles.add(instruction.path);
      applied += 1;
    }

    return applied;
  }
}
