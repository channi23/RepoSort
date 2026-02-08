import { Body, Controller, Inject, Logger, Post, Req, Get, Param } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../../queue/queues/queue.names';
import { CreateRunDto } from './dto/create-run.dto';
import { RunsService } from './runs.service';

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
}
