import { Body, Controller, Post } from '@nestjs/common';
import { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
    constructor(private readonly agent: AgentService) { }

    @Post('chat')
    async chat(@Body() body: { projectId: string; prompt: string }) {
        return this.agent.chat(body.projectId, body.prompt);
    }
}
