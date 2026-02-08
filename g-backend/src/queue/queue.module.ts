import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {BuildGraphWorker} from './processors/build-graph.worker';
import { Queue } from 'bullmq';
import {SandboxModule} from '../sandbox/sandbox.module';
import { QueueTestController } from './queue-test.controller';
import { QUEUE_NAMES } from './queues/queue.names';
import {IngestWorker} from './processors/ingest.worker';
import {QUEUE_REGISTRY} from './queue.tokens';
import {TestWorker} from './processors/test.worker';
@Global()
@Module({
  imports: [ConfigModule,SandboxModule],
  controllers: [QueueTestController],
  providers: [
    TestWorker,
    IngestWorker,
    BuildGraphWorker,
    {
      provide: QUEUE_REGISTRY,
      useFactory: () => {
        const makeQueue = (name: string) =>
          new Queue(name, {
            connection: {
              host: 'localhost',
              port: 6379,
            },
          });

        return {
          test: makeQueue(QUEUE_NAMES.TEST),

          ingest: makeQueue(QUEUE_NAMES.INGEST_REPO),
          graph: makeQueue(QUEUE_NAMES.BUILD_GRAPH),
          analyze: makeQueue(QUEUE_NAMES.ANALYZE_GRAPH),
          plan: makeQueue(QUEUE_NAMES.CREATE_PLAN),
          apply: makeQueue(QUEUE_NAMES.APPLY_PLAN),
          verify: makeQueue(QUEUE_NAMES.VERIFY_RUN),
          diff: makeQueue(QUEUE_NAMES.DIFF_RUN),
          export: makeQueue(QUEUE_NAMES.VERIFY_ARTIFACTS),
        };
      },
    },
  ],
  exports: [QUEUE_REGISTRY],
})
export class QueueModule {}
