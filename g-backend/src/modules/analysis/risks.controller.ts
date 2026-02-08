import { Controller, Get, Param, Req, Logger, NotFoundException, Query } from '@nestjs/common';
import type{ Request } from 'express';
import { PrismaService } from '../../db/prisma.service';

@Controller('projects/:id')
export class RisksController {
  private readonly logger = new Logger(RisksController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('risks')
  async getRisks(
    @Param('id') projectId: string,
    @Query('ref') ref: string | undefined,
    @Req() req: Request,
  ) {
    const traceId = (req as any).traceId;

    const graphSnapshot = await this.prisma.graphSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!graphSnapshot) throw new NotFoundException(`No GraphSnapshot found for project ${projectId}`);

    const risks = await this.prisma.risk.findMany({
      where: { graphSnapshotId: graphSnapshot.id },
      orderBy: { createdAt: 'desc' },
      include: {
        nodes: { select: { nodeId: true } },
      },
    });

    this.logger.log(`[traceId=${traceId}] getRisks project=${projectId} graph=${graphSnapshot.id} count=${risks.length}`);

    return {
      graphSnapshotId: graphSnapshot.id,
      risks: risks.map(r => ({
        id: r.id,
        type: r.type,
        severity: r.severity,
        title: r.title,
        description: r.description,
        ruleId: r.ruleId,
        meta: r.meta,
        createdAt: r.createdAt,
        nodeIds: r.nodes.map(n => n.nodeId),
      })),
    };
  }
}
