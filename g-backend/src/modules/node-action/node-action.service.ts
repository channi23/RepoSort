import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';

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
    return this.prisma.nodeAction.findUnique({
      where: { id },
    });
  }
}
