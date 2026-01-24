import{Body,Controller,Inject,Post} from "@nestjs/common";
import {QUEUE_REGISTRY} from './queue.tokens';
@Controller('queue')
export class QueueTestController{
    constructor(@Inject(QUEUE_REGISTRY) private readonly queues:any){}

    @Post('test')
    async enqueue(@Body() body:any){
        const job = await this.queues.test.add('ping',{
            message: body?.message ?? "hello",
            ts: new Date().toISOString(),

        });
        return {queued: true, jobId: job.id, queue: 'TEST_QUEUE'  };
    }
}
