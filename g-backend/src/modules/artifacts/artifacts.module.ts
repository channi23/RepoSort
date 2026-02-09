import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { StorageModule } from '../../storage/storage.module';
import { ArtifactsController } from './artifacts.controller';
import { GovernanceModule } from '../governance/governance.module';

@Module({
  imports: [StorageModule, GovernanceModule],
  controllers: [ExportsController, ArtifactsController],
})
export class ArtifactsModule {}
