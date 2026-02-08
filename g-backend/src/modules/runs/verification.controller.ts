import { Controller, Get, Inject, Logger, Param, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../../queue/queues/queue.names';

@Controller()
export class VerificationController {
  private readonly logger = new Logger(VerificationController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_REGISTRY) private readonly queues: any,
  ) {}

  @Get('runs/:runId/verification')
  async getOrCreate(@Param('runId') runId: string, @Req() req: Request) {
    const traceId = (req as any).traceId;

    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const existing = await this.prisma.verificationReport.findUnique({
      where: { runId },
    });

    if (existing) {
      this.logger.log(`[traceId=${traceId}] verification exists run=${runId}`);
      return { queued: false, runId, verification: existing };
    }

    const job = await this.queues.verify.add(QUEUE_NAMES.VERIFY_RUN, {
      runId,
      traceId,
    });

    this.logger.log(`[traceId=${traceId}] VERIFY_RUN enqueued jobId=${job.id} run=${runId}`);

    return { queued: true, jobId: job.id, runId, traceId, queue: QUEUE_NAMES.VERIFY_RUN };
  }
}
