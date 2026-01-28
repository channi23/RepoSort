import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './db/db.module';
import { QueueModule } from './queue/queue.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import {SandBoxModule} from './sandbox/sandbox.module';
import {StorageModule} from './storage/storage.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    PrismaModule,   // ✅ load Prisma globally
    QueueModule,     // queue registry
    SandBoxModule,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
