import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { getGeminiConfig } from '../config/gemini.config';

export type PipelineStepName =
  | 'INGEST'
  | 'BUILD_GRAPH'
  | 'ANALYZE'
  | 'CREATE_PLAN'
  | 'APPLY_PLAN'
  | 'VERIFY'
  | 'DIFF'
  | 'EXPORT';

export type RunWithGeminiFirstInput<T> = {
  stepName: PipelineStepName;
  traceId?: string;
  projectId: string;
  runId?: string;
  nodeActionId?: string;
  geminiFn: () => Promise<T>;
  fallbackFn: () => Promise<T>;
};

export type GeminiRunResult<T> = {
  value: T;
  source: 'GEMINI' | 'FALLBACK';
  model: string | null;
  latencyMs: number;
};

@Injectable()
export class GeminiRunnerService {
  private readonly logger = new Logger(GeminiRunnerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runWithGeminiFirst<T>(input: RunWithGeminiFirstInput<T>): Promise<GeminiRunResult<T>> {
    const cfg = getGeminiConfig();

    if (cfg.required && !cfg.apiKey) {
      throw new Error('Gemini is required but GEMINI_API_KEY is missing');
    }

    const geminiStart = Date.now();
    try {
      const value = await input.geminiFn();
      const latencyMs = Date.now() - geminiStart;
      await this.record({
        projectId: input.projectId,
        runId: input.runId,
        nodeActionId: input.nodeActionId,
        stepName: input.stepName,
        source: 'GEMINI',
        model: cfg.model,
        latencyMs,
        success: true,
      });
      return { value, source: 'GEMINI', model: cfg.model, latencyMs };
    } catch (error: any) {
      const geminiLatency = Date.now() - geminiStart;
      const message = error?.message ?? String(error);

      await this.record({
        projectId: input.projectId,
        runId: input.runId,
        nodeActionId: input.nodeActionId,
        stepName: input.stepName,
        source: 'GEMINI',
        model: cfg.model,
        latencyMs: geminiLatency,
        success: false,
        error: message,
      });

      if (cfg.required) {
        throw new Error(`[source=GEMINI] ${message}`);
      }

      const fallbackStart = Date.now();
      try {
        const fallbackValue = await input.fallbackFn();
        const fallbackLatency = Date.now() - fallbackStart;
        await this.record({
          projectId: input.projectId,
          runId: input.runId,
          nodeActionId: input.nodeActionId,
          stepName: input.stepName,
          source: 'FALLBACK',
          model: null,
          latencyMs: fallbackLatency,
          success: true,
        });
        return {
          value: fallbackValue,
          source: 'FALLBACK',
          model: null,
          latencyMs: fallbackLatency,
        };
      } catch (fallbackError: any) {
        const fallbackLatency = Date.now() - fallbackStart;
        const fallbackMessage = fallbackError?.message ?? String(fallbackError);
        await this.record({
          projectId: input.projectId,
          runId: input.runId,
          nodeActionId: input.nodeActionId,
          stepName: input.stepName,
          source: 'FALLBACK',
          model: null,
          latencyMs: fallbackLatency,
          success: false,
          error: fallbackMessage,
        });
        throw fallbackError;
      }
    }
  }

  private async record(input: {
    projectId: string;
    runId?: string;
    nodeActionId?: string;
    stepName: PipelineStepName;
    source: 'GEMINI' | 'FALLBACK';
    model: string | null;
    latencyMs: number;
    success: boolean;
    error?: string;
  }) {
    try {
      await this.prisma.stepExecution.create({
        data: {
          projectId: input.projectId,
          runId: input.runId ?? null,
          nodeActionId: input.nodeActionId ?? null,
          stepName: input.stepName,
          source: input.source,
          model: input.model,
          latencyMs: Math.max(0, Math.round(input.latencyMs)),
          success: input.success,
          error: input.error ?? null,
        },
      });
    } catch (error: any) {
      this.logger.warn(`step execution write failed: ${error?.message ?? error}`);
    }
  }
}
