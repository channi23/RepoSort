import { Body, Controller, Inject, Logger, Post, Req, Get, Param } from '@nestjs/common';
import type { Request } from 'express';
import { QUEUE_REGISTRY } from '../../queue/queue.tokens';
import { QUEUE_NAMES } from '../../queue/queues/queue.names';
import { NodeActionService } from './node-action.service';
import { CreateNodeActionDto } from './dto/create-node-action.dto';

@Controller('node-actions')
export class NodeActionController {
  private readonly logger = new Logger(NodeActionController.name);

  constructor(
    private readonly actions: NodeActionService,
    @Inject(QUEUE_REGISTRY) private readonly queues: any,
  ) {}

  @Post('refactor')
  async refactor(@Body() dto: CreateNodeActionDto, @Req() req: Request) {
    return this.startAction('REFACTOR', dto, req);
  }

  @Post('harden')
  async harden(@Body() dto: CreateNodeActionDto, @Req() req: Request) {
    return this.startAction('HARDEN', dto, req);
  }

  @Post('add-tests')
  async addTests(@Body() dto: CreateNodeActionDto, @Req() req: Request) {
    return this.startAction('ADD_TESTS', dto, req);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.actions.getAction(id);
  }

  private async startAction(type: 'REFACTOR' | 'HARDEN' | 'ADD_TESTS', dto: CreateNodeActionDto, req: Request) {
    const traceId = (req as any).traceId;

    const { nodeActionId, planId, repoSnapshotId } = await this.actions.createAction({
      type,
      projectId: dto.projectId,
      graphSnapshotId: dto.graphSnapshotId,
      selectedNodeIds: dto.selectedNodeIds,
      prompt: dto.prompt,
      traceId,
    });

    const job = await this.queues.plan.add(QUEUE_NAMES.CREATE_PLAN, {
      nodeActionId,
      planId,
      projectId: dto.projectId,
      graphSnapshotId: dto.graphSnapshotId,
      repoSnapshotId,
      traceId,
    });

    this.logger.log(`[traceId=${traceId}] nodeAction queued type=${type} action=${nodeActionId} plan=${planId} job=${job.id}`);

    return { queued: true, jobId: job.id, nodeActionId, planId, traceId, queue: QUEUE_NAMES.CREATE_PLAN };
  }
}
