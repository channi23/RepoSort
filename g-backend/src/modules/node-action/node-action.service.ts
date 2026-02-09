import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';
import { getGeminiConfig } from '../../config/gemini.config';

type ActionType = 'REFACTOR' | 'HARDEN' | 'ADD_TESTS';

@Injectable()
export class NodeActionService {
  constructor(private readonly prisma: PrismaService) {}

  async createAction(params: {
    type: ActionType;
    projectId: string;
    graphSnapshotId: string;
    selectedNodeIds: string[];
    prompt?: string;
    traceId?: string;
  }) {
    const { type, projectId, graphSnapshotId, selectedNodeIds, prompt, traceId } = params;

    // Find repoSnapshotId from graphSnapshot
    const graph = await this.prisma.graphSnapshot.findUnique({
      where: { id: graphSnapshotId },
      select: { repoSnapshotId: true, projectId: true },
    });

    if (!graph || graph.projectId !== projectId) {
      throw new Error(`GraphSnapshot not found for project`);
    }

    if (selectedNodeIds.length > 0) {
      const validNodeCount = await this.prisma.node.count({
        where: { graphSnapshotId, id: { in: selectedNodeIds } },
      });
      if (validNodeCount !== selectedNodeIds.length) {
        throw new Error('selectedNodeIds contain nodes outside the graph snapshot');
      }
    }

    const defaultPrompt =
      type === 'REFACTOR'
        ? 'Refactor selected code to improve structure and maintainability.'
        : type === 'HARDEN'
          ? 'Harden selected area: add validation, fix unsafe patterns, and improve security posture.'
          : 'Add tests for the selected area and ensure coverage for the changes.';

    const finalPrompt = prompt?.trim() ? prompt.trim() : defaultPrompt;

    // Create Plan FIRST (draft) so the pipeline has a planId
    const plan = await this.prisma.plan.create({
      data: {
        projectId,
        graphSnapshotId,
        prompt: finalPrompt,
        selectedNodeIds,
        status: 'DRAFT',
      },
      select: { id: true },
    });

    // Create NodeAction tracker
    const action = await this.prisma.nodeAction.create({
      data: {
        type,
        status: 'QUEUED',
        projectId,
        graphSnapshotId,
        repoSnapshotId: graph.repoSnapshotId,
        planId: plan.id,
        prompt: finalPrompt,
        selectedNodeIds,
        traceId: traceId ?? null,
      },
      select: { id: true, planId: true, repoSnapshotId: true },
    });

    return { nodeActionId: action.id, planId: plan.id, repoSnapshotId: action.repoSnapshotId };
  }

  async getAction(id: string) {
    const action = await this.prisma.nodeAction.findUnique({
      where: { id },
    });
    if (!action) return action;

    if (!getGeminiConfig().debugSource) return action;

    const where = action.runId
      ? { OR: [{ nodeActionId: id }, { runId: action.runId }] }
      : { nodeActionId: id };
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
        where: where as any,
        orderBy: { createdAt: 'desc' },
      }) as any;
    } catch {
      // Keep endpoint stable even if provenance tables are not migrated yet.
      return action;
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
    return { ...action, executionSources };
  }

  async updateActionStatus(id: string, status: 'QUEUED' | 'PENDING_APPROVAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED', error?: string | null) {
    return this.prisma.nodeAction.update({
      where: { id },
      data: { status, error: error ?? null },
    });
  }

  async getNodePaths(graphSnapshotId: string, nodeIds: string[]) {
    if (!nodeIds.length) return [];
    const nodes = await this.prisma.node.findMany({
      where: { graphSnapshotId, id: { in: nodeIds } },
      select: { path: true, label: true },
    });
    return nodes.map((n) => n.path ?? n.label);
  }
}
