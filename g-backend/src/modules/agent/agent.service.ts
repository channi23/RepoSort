import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../../llm/gemini.service';
import { PrismaService } from '../../db/prisma.service';

@Injectable()
export class AgentService {
    private readonly logger = new Logger(AgentService.name);

    constructor(
        private readonly gemini: GeminiService,
        private readonly prisma: PrismaService,
    ) { }

    async chat(projectId: string, prompt: string) {
        const graphSnapshot = await this.prisma.graphSnapshot.findFirst({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });

        // Provide context about the current graph
        let graphContext = "No graph data available.";
        if (graphSnapshot) {
            const nodes = await this.prisma.node.findMany({ where: { graphSnapshotId: graphSnapshot.id }, take: 50 });
            graphContext = `Current graph nodes: ${nodes.map(n => `${n.label} (id: ${n.id}, type: ${n.type})`).join(', ')}`;
        }

        const systemPrompt = `
      You are an AI Architect Agent. You help users visualize and refactor their repository.
      
      Graph Context: ${graphContext}
      
      When the user asks to "refactor", propose a series of 'rename', 'remove', 'addNode', or 'connect' actions      You can propose actions to modify the graph or the code.
      Respond with a JSON object:
      {
        "message": "Friendly response to user detailing the plan",
        "actions": [
          { "type": "addNode", "id": "string", "label": "string" },
          { "type": "connect", "from": "id", "to": "id" },
          { "type": "rename", "id": "id", "value": "new name" },
          { "type": "remove", "id": "id" },
          { "type": "refactor", "nodeIds": ["id1", "id2"], "prompt": "specific refactor instructions" }
        ]
      }
      
      Only use 'addNode', 'connect', 'rename', 'remove', 'refactor'.
      Use 'refactor' when the user asks for code-level changes.
    `;

        const result = await this.gemini.generateJson<{ message: string; actions: any[] }>(
            systemPrompt,
            prompt,
            60_000
        );

        if (!result) {
            return {
                message: "I'm sorry, I couldn't process that request at the moment.",
                actions: []
            };
        }

        return result;
    }
}
