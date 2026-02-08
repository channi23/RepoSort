import {
  Controller,
  Post,
  Inject,
  Param,
  Req,
  Logger,
  NotFoundException,
  Get,
  Query,
} from '@nestjs/common';
import type{ Request } from 'express';
import { PrismaService } from '../../db/prisma.service';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../../queue/queues/queue.names';

@Controller('projects/:id/graph')
export class GraphController {
  private readonly logger = new Logger(GraphController.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_REGISTRY) private readonly queues: any,
  ) {}

  @Post('build')
  async buildGraph(@Param('id') projectId: string, @Req() req: Request) {
    const traceId = (req as any).traceId;

    this.logger.log(`[traceId=${traceId}] build graph requested for project=${projectId}`);

    const snapshot = await this.prisma.repoSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!snapshot) {
      throw new NotFoundException(`No RepoSnapshot found for project ${projectId}`);
    }

    const job = await this.queues.graph.add(QUEUE_NAMES.BUILD_GRAPH, {
      projectId,
      repoSnapshotId: snapshot.id,
      traceId,
    });

    this.logger.log(
      `[traceId=${traceId}] BUILD_GRAPH enqueued jobId=${job.id} snapshot=${snapshot.id}`,
    );

    return {
      queued: true,
      jobId: job.id,
      projectId,
      repoSnapshotId: snapshot.id,
      traceId,
      queue: QUEUE_NAMES.BUILD_GRAPH,
    };
  }

  // A) GET /projects/:id/graph?ref=latest
  @Get()
  async getGraph(
    @Param('id') projectId: string,
    @Query('ref') ref: string | undefined,
    @Req() req: Request,
  ) {
    const traceId = (req as any).traceId;

    const graphSnapshot = await this.prisma.graphSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!graphSnapshot) {
      throw new NotFoundException(`No GraphSnapshot found for project ${projectId}`);
    }

    const [dbNodes, dbEdges] = await Promise.all([
      this.prisma.node.findMany({ where: { graphSnapshotId: graphSnapshot.id } }),
      this.prisma.edge.findMany({ where: { graphSnapshotId: graphSnapshot.id } }),
    ]);

    const nodes = dbNodes.map((n) => ({
      id: n.id,
      type: String(n.type),
      position: { x: 0, y: 0 },
      data: { label: n.label },
    }));

    const edges = dbEdges.map((e) => ({
      id: e.id,
      source: e.fromNodeId,
      target: e.toNodeId,
      label: String(e.type),
    }));

    this.logger.log(
      `[traceId=${traceId}] getGraph project=${projectId} snapshot=${graphSnapshot.id} nodes=${nodes.length} edges=${edges.length}`,
    );

    return { graphSnapshotId: graphSnapshot.id, nodes, edges };
  }

  // B) GET /projects/:id/graph/snapshots
  @Get('snapshots')
  async getGraphSnapshots(@Param('id') projectId: string, @Req() req: Request) {
    const traceId = (req as any).traceId;

    const snapshots = await this.prisma.graphSnapshot.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        nodeCount: true,
        edgeCount: true,
        repoSnapshotId: true,
      },
    });

    this.logger.log(
      `[traceId=${traceId}] listGraphSnapshots project=${projectId} count=${snapshots.length}`,
    );

    return snapshots;
  }
}
