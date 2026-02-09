import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import type { PolicyDecision, Role } from './governance.types';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    projectId: string;
    traceId?: string;
    actorRole: Role | string;
    action: string;
    entityType: string;
    entityId: string;
    decision: PolicyDecision;
    meta?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          projectId: input.projectId,
          traceId: input.traceId ?? null,
          actorRole: String(input.actorRole),
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          decision: input.decision,
          meta: (input.meta ?? undefined) as any,
        },
      });
    } catch (error: any) {
      this.logger.warn(`audit write failed: ${error?.message ?? error}`);
    }
  }
}
