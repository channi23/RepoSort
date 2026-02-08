import { Controller, Get, Inject, Logger, NotFoundException, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../../queue/queues/queue.names';
import * as fs from 'fs';

@Controller('runs')
export class DiffsController {
  private readonly logger = new Logger(DiffsController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_REGISTRY) private readonly queues: any,
  ) {}

  @Get(':runId/diff')
  async getDiff(@Param('runId') runId: string, @Req() req: Request) {
    const traceId = (req as any).traceId;

    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);

    const existing = await this.prisma.diffReport.findUnique({ where: { runId } });
    if (existing) {
      this.logger.log(`[traceId=${traceId}] diff exists run=${runId}`);
      let reportJson: any = null;
      if (existing.reportPath && fs.existsSync(existing.reportPath)) {
        reportJson = JSON.parse(fs.readFileSync(existing.reportPath, 'utf-8'));
      }
      return { queued: false, runId, diff: existing, report: reportJson };
    }

    const job = await this.queues.diff.add(QUEUE_NAMES.DIFF_RUN, { runId, traceId });
    this.logger.log(`[traceId=${traceId}] DIFF_RUN enqueued jobId=${job.id} run=${runId}`);

    return { queued: true, jobId: job.id, runId, traceId, queue: QUEUE_NAMES.DIFF_RUN };
  }
}
