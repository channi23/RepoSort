import { Module } from '@nestjs/common';
import { NodeController } from './node.controller';
import { PrismaModule } from '../../db/db.module';

@Module({
    imports: [PrismaModule],
    controllers: [NodeController],
    exports: [],
})
export class NodeModule { }
