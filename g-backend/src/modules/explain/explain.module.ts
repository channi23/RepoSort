import { Module } from '@nestjs/common';
import { ExplainController } from './explain.controller';
import { ExplainService } from './explain.service';
import { PrismaModule } from '../../db/db.module';
import { LlmModule } from '../../llm/llm.module';

@Module({
    imports: [PrismaModule, LlmModule],
    controllers: [ExplainController],
    providers: [ExplainService],
})
export class ExplainModule { }
