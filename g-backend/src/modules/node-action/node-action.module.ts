import { Module } from '@nestjs/common';
import { NodeActionController } from './node-action.controller';
import { NodeActionService } from './node-action.service';
@Module({
  controllers: [NodeActionController],
  providers: [NodeActionService],
  exports: [NodeActionService],
})
export class NodeActionModule {}
