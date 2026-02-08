import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestGraphSnapshotId(projectId: string) {
    const gs = await this.prisma.graphSnapshot.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!gs) throw new NotFoundException(`No GraphSnapshot found for project ${projectId}`);
    return gs.id;
  }

  async getPlan(planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!plan) throw new NotFoundException(`Plan not found: ${planId}`);
    return plan;
  }

  async approvePlan(planId: string) {
    const plan = await this.prisma.plan.update({
      where: { id: planId },
      data: { status: 'APPROVED' },
    });
    return plan;
  }
}
