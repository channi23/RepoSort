import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { LlmModule } from '../../llm/llm.module';
import { PrismaModule } from '../../db/db.module';

@Module({
    imports: [LlmModule, PrismaModule],
    controllers: [AgentController],
    providers: [AgentService],
})
export class AgentModule { }
