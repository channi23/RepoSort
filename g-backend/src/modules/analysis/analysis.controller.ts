import { Controller, Post, Param, Req, Inject, Logger, NotFoundException } from '@nestjs/common';
import type{ Request } from 'express';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../../queue/queues/queue.names';

@Controller('projects/:id')
export class AnalysisController {
  private readonly logger = new Logger(AnalysisController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_REGISTRY) private readonly queues: any,
  ) {}

  @Post('analyze')
  async analyze(@Param('id') projectId: string, @Req() req: Request) {
    const traceId = (req as any).traceId;

    // Ensure there is at least one graph snapshot (analysis attaches risks to a graph)
    const graphSnapshot = await this.prisma.graphSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!graphSnapshot) throw new NotFoundException(`No GraphSnapshot found for project ${projectId}`);

    const job = await this.queues.analyze.add(QUEUE_NAMES.ANALYZE_REPO, {
      projectId,
      graphSnapshotId: graphSnapshot.id,
      traceId,
    });

    this.logger.log(`[traceId=${traceId}] ANALYZE_REPO enqueued jobId=${job.id} graph=${graphSnapshot.id}`);

    return { queued: true, jobId: job.id, projectId, graphSnapshotId: graphSnapshot.id, traceId, queue: QUEUE_NAMES.ANALYZE_REPO };
  }
}
