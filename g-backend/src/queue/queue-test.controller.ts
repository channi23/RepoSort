import{Body,Controller,Inject,Post,Req,Logger} from "@nestjs/common";
import {QUEUE_REGISTRY} from './queue.tokens';
import type {Request} from 'express';
@Controller('queue')
export class QueueTestController{
    private readonly logger = new Logger(QueueTestController.name);

    constructor(@Inject(QUEUE_REGISTRY) private readonly queues:any){}

    @Post('test')
    async enqueue(@Body() body:any, @Req() req:Request){
        const traceId = (req as any).traceId;
        this.logger.log(`traceId=${traceId} enqueue request body=${JSON.stringify(body)}`);
        const job = await this.queues.test.add('ping',{
            traceId,
            message: body?.message ?? "hello",
            ts: new Date().toISOString(),

        });
        this.logger.log(`[traceId=${traceId}] enqueued jobId=${job.id}`);
        return {queued: true, jobId: job.id, queue: 'TEST_QUEUE',traceId };

    }
}

