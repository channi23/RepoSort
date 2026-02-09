import {
  Body,
  Controller,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  Get,
} from '@nestjs/common';
import type { Request } from 'express';

import { PrismaService } from '../../db/prisma.service';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../../queue/queues/queue.names';
import { CreatePlanDto } from './dto/create-plan.dto';
import { PlanningService } from './planning.service';
import { Roles } from '../governance/roles.decorator';

@Controller()
export class PlanningController {
  private readonly logger = new Logger(PlanningController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planning: PlanningService,
    @Inject(QUEUE_REGISTRY) private readonly queues: any,
  ) {}

  // POST /projects/:id/plans
  @Post('projects/:id/plans')
  async createPlan(@Param('id') projectId: string, @Body() dto: CreatePlanDto, @Req() req: Request) {
    const traceId = (req as any).traceId;
    const prompt = (dto?.prompt ?? '').trim();
    const selectedNodeIds = Array.isArray(dto?.selectedNodeIds) ? dto.selectedNodeIds : [];

    if (!prompt) throw new NotFoundException('prompt is required');
    if (selectedNodeIds.length === 0) throw new NotFoundException('selectedNodeIds is required');

    const graphSnapshotId = await this.planning.getLatestGraphSnapshotId(projectId);

    // create Plan row first (fast endpoint)
    const plan = await this.prisma.plan.create({
      data: {
        projectId,
        graphSnapshotId,
        prompt,
        selectedNodeIds,
        status: 'DRAFT',
      },
      select: { id: true },
    });

    // enqueue CREATE_PLAN
    const job = await this.queues.plan.add(QUEUE_NAMES.CREATE_PLAN, {
      projectId,
      planId: plan.id,
      graphSnapshotId,
      prompt,
      selectedNodeIds,
      traceId,
    });

    this.logger.log(
      `[traceId=${traceId}] CREATE_PLAN enqueued jobId=${job.id} plan=${plan.id} graph=${graphSnapshotId}`,
    );

    return {
      queued: true,
      jobId: job.id,
      planId: plan.id,
      projectId,
      graphSnapshotId,
      traceId,
      queue: QUEUE_NAMES.CREATE_PLAN,
    };
  }

  // GET /plans/:planId
  @Get('plans/:planId')
  async getPlan(@Param('planId') planId: string, @Req() req: Request) {
    const traceId = (req as any).traceId;
    const plan = await this.planning.getPlan(planId);

    this.logger.log(`[traceId=${traceId}] getPlan planId=${planId} steps=${plan.steps.length}`);
    return plan;
  }

  // OPTIONAL: POST /plans/:planId/approve
  @Post('plans/:planId/approve')
  @Roles('admin')
  async approve(@Param('planId') planId: string, @Req() req: Request) {
    const traceId = (req as any).traceId;
    const plan = await this.planning.approvePlan(planId);
    this.logger.log(`[traceId=${traceId}] approvePlan planId=${planId}`);
    return { approved: true, planId: plan.id, status: plan.status, traceId };
  }
}
