import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { getGeminiConfig } from '../../config/gemini.config';

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRun(runId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: { patch: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);
    const debug = getGeminiConfig().debugSource;
    if (!debug) return run;

    let executions: Array<{
      stepName: string;
      source: string;
      model: string | null;
      latencyMs: number;
      success: boolean;
      createdAt: Date;
    }> = [];
    try {
      executions = await this.prisma.stepExecution.findMany({
        where: { runId },
        orderBy: { createdAt: 'desc' },
      }) as any;
    } catch {
      return run;
    }
    const seen = new Set<string>();
    const executionSources: Array<{ stepName: string; source: string; model: string | null; latencyMs: number; success: boolean; createdAt: Date }> = [];
    for (const ex of executions) {
      if (seen.has(ex.stepName)) continue;
      seen.add(ex.stepName);
      executionSources.push({
        stepName: ex.stepName,
        source: ex.source,
        model: ex.model,
        latencyMs: ex.latencyMs,
        success: ex.success,
        createdAt: ex.createdAt,
      });
    }
    return { ...run, executionSources };
  }
}
