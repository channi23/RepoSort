import { Module } from '@nestjs/common';
import {RunsController} from './runs.controller';
import {RunsService} from './runs.service';
import {VerificationController} from './verification.controller';

@Module({
    controllers:[RunsController,VerificationController],
    providers:[RunsService],
})
export class RunsModule {}
