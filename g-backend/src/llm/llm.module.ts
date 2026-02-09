import { Global, Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { GeminiRunnerService } from './gemini-runner.service';

@Global()
@Module({
  providers: [GeminiService, GeminiRunnerService],
  exports: [GeminiService, GeminiRunnerService],
})
export class LlmModule {}
