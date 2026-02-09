import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './db/db.module';
import { QueueModule } from './queue/queue.module';

import { TraceMiddleware } from './common/middleware/trace.middleware';


import { AppController } from './app.controller';
import { AppService } from './app.service';

import { SandboxModule } from './sandbox/sandbox.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { GraphModule } from './modules/graph/graph.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { PlanningModule } from './modules/planning/planning.module';
import { RunsModule } from './modules/runs/runs.module';
import { DiffsModule } from './modules/diffs/diffs.module';
import { NodeActionModule } from './modules/node-action/node-action.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { LlmModule } from './llm/llm.module';
import { AgentModule } from './modules/agent/agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    PrismaModule,
    QueueModule,
    SandboxModule,
    StorageModule,
    AuthModule,
    ProjectsModule,
    IngestionModule,
    GraphModule,
    AnalysisModule,
    PlanningModule,
    RunsModule,
    DiffsModule,
    NodeActionModule,
    GovernanceModule,
    ArtifactsModule,
    LlmModule,
    AgentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
