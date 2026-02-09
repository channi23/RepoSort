import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApprovalService } from './approval.service';
import { Roles } from './roles.decorator';

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalService) {}

  @Get()
  @Roles('admin')
  async list(@Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    return this.approvals.list(status);
  }

  @Post(':id/approve')
  @Roles('admin')
  async approve(@Param('id') id: string, @Req() req: Request) {
    const traceId = (req as any).traceId;
    const actorRole = (req as any).actorRole ?? 'developer';
    return this.approvals.approve(id, { traceId, actorRole });
  }

  @Post(':id/reject')
  @Roles('admin')
  async reject(@Param('id') id: string, @Req() req: Request) {
    const traceId = (req as any).traceId;
    const actorRole = (req as any).actorRole ?? 'developer';
    return this.approvals.reject(id, { traceId, actorRole });
  }
}
