import { Controller, Post, Body, Param, BadRequestException, Logger } from '@nestjs/common';
import { ExplainService } from './explain.service';

@Controller('explain')
export class ExplainController {
    private readonly logger = new Logger(ExplainController.name);

    constructor(private readonly explainService: ExplainService) { }

    @Post()
    async explain(@Body() body: { projectId: string; nodeId: string }) {
        this.logger.log(`Explain request received: projectId=${body.projectId}, nodeId=${body.nodeId}`);

        if (!body.projectId || !body.nodeId) {
            this.logger.error('Missing required fields in explain request');
            throw new BadRequestException('projectId and nodeId are required');
        }

        try {
            const description = await this.explainService.explainNode(body.projectId, body.nodeId);
            return { description };
        } catch (error: any) {
            this.logger.error(`Failed to explain node: ${error.message}`, error.stack);
            throw error;
        }
    }
}
