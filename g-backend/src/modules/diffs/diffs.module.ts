import { Module } from '@nestjs/common';
import {DiffsController} from './diffs.controller';

@Module({
    controllers:[DiffsController],
})
export class DiffsModule {}
