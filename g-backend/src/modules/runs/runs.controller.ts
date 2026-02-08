import { Body, Controller, Inject, Logger, Post, Req, Get, Param, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../../queue/queues/queue.names';
import { CreateRunDto } from './dto/create-run.dto';
import { RunsService } from './runs.service';
import * as fs from 'fs';

@Controller()
export class RunsController {
  private readonly logger = new Logger(RunsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runs: RunsService,
    @Inject(QUEUE_REGISTRY) private readonly queues: any,
  ) {}

  // POST /runs
  @Post('runs')
  async createRun(@Body() dto: CreateRunDto, @Req() req: Request) {
    const traceId = (req as any).traceId;

    const run = await this.prisma.run.create({
      data: {
        projectId: dto.projectId,
        repoSnapshotId: dto.repoSnapshotId,
        planId: dto.planId,
        status: 'QUEUED',
      },
      select: { id: true },
    });

    const job = await this.queues.apply.add(QUEUE_NAMES.APPLY_PLAN, {
      runId: run.id,
      projectId: dto.projectId,
      repoSnapshotId: dto.repoSnapshotId,
      planId: dto.planId,
      traceId,
    });

    this.logger.log(`[traceId=${traceId}] APPLY_PLAN enqueued jobId=${job.id} run=${run.id}`);

    return { queued: true, jobId: job.id, runId: run.id, traceId, queue: QUEUE_NAMES.APPLY_PLAN };
  }

  // GET /runs/:runId
  @Get('runs/:runId')
  async getRun(@Param('runId') runId: string, @Req() req: Request) {
    const traceId = (req as any).traceId;
    const run = await this.runs.getRun(runId);
    this.logger.log(`[traceId=${traceId}] getRun runId=${runId} status=${run.status}`);
    return run;
  }

  // GET /runs/:runId/patch
  @Get('runs/:runId/patch')
  async getPatch(@Param('runId') runId: string, @Req() req: Request) {
    const traceId = (req as any).traceId;

    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: { patch: true },
    });

    if (!run) throw new NotFoundException(`Run not found: ${runId}`);
    if (!run.patch?.path) throw new NotFoundException(`Patch not found for run=${runId}`);
    if (!fs.existsSync(run.patch.path)) throw new NotFoundException(`Patch file missing on disk: ${run.patch.path}`);

    const patchText = fs.readFileSync(run.patch.path, 'utf-8');

    this.logger.log(
      `[traceId=${traceId}] getPatch run=${runId} bytes=${Buffer.byteLength(patchText, 'utf-8')}`,
    );

    return {
      runId,
      path: run.patch.path,
      bytes: Buffer.byteLength(patchText, 'utf-8'),
      patch: patchText,
    };
  }
    // GET /runs/:runId/diff
@Get('runs/:runId/diff')
async getDiff(@Param('runId') runId: string, @Req() req: Request) {
  const traceId = (req as any).traceId;

  const existing = await this.prisma.diffReport.findUnique({
    where: { runId },
  });

  if (existing) {
    this.logger.log(`[traceId=${traceId}] diff exists run=${runId}`);
    return { queued: false, diff: existing };
  }

  const job = await this.queues.diff.add(QUEUE_NAMES.DIFF_RUN, {
    runId,
    traceId,
  });

  this.logger.log(`[traceId=${traceId}] DIFF_RUN enqueued jobId=${job.id} run=${runId}`);

  return { queued: true, jobId: job.id, runId };
 }
}
