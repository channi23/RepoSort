import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SandboxModule } from '../../sandbox/sandbox.module';
import { RolesGuard } from './roles.guard';
import { PolicyService } from './policy.service';
import { AuditService } from './audit.service';
import { ApprovalService } from './approval.service';
import { ApprovalsController } from './approvals.controller';

@Global()
@Module({
  imports: [SandboxModule],
  controllers: [ApprovalsController],
  providers: [
    PolicyService,
    AuditService,
    ApprovalService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [PolicyService, AuditService, ApprovalService],
})
export class GovernanceModule {}
