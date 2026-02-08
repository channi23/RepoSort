import { Module } from '@nestjs/common';
import {AnalysisController} from './analysis.controller';
import {RisksController} from  './risks.controller';

@Module({
    controllers:[AnalysisController,RisksController],
})
export class AnalysisModule {}
