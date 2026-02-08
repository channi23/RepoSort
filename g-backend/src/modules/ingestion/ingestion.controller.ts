import { Controller, Param, Post, Req, Inject } from '@nestjs/common';
import type { Request } from 'express';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../../queue/queues/queue.names';

@Controller('projects')
export class IngestionController {
  constructor(@Inject(QUEUE_REGISTRY) private readonly queues: any) {}

  @Post(':id/ingest')
  async ingest(@Param('id') projectId: string, @Req() req: Request) {
    const traceId = (req as any).traceId;

    const job = await this.queues.ingest.add(
      'ingest-repo',
      { projectId, traceId },
      { removeOnComplete: true, removeOnFail: false },
    );

    return { queued: true, jobId: job.id, projectId, traceId, queue: QUEUE_NAMES.INGEST_REPO };
  }
}
