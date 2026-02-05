//this is the worker code, which needs to consider the job which is already there in the queue

import {Injectable, OnModuleInit, OnModuleDestroy,Logger} from '@nestjs/common';
import {Worker,Job} from 'bullmq';
import {QUEUE_NAMES} from '../queues/queue.names';

@Injectable()
export class TestWorker implements OnModuleInit,OnModuleDestroy{
    //init the logger  here, basically used to create logs 
    private readonly logger = new Logger(TestWorker.name);
    private worker!:Worker; //! - it basically says  that it promises to initialize it before using it

    async onModuleInit(){
        this.worker = new Worker(
            QUEUE_NAMES.TEST,
            async (job:Job)=>{
                const traceId = (job.data as any)?.traceId ?? 'no-trace';
                this.logger.log(`Picked job id=${job.id} name=${job.name}`);
                this.logger.log(`Job data: ${JSON.stringify(job.data)} `);

                return {okay:'true'};
            },
            {
                connection: {host: 'localhost',port: 6379},
            },
        );
        this.worker.on('completed',(job:Job)=>{
            const traceId = (job.returnvalue as any)?.traceId ??(job.data as any)?.traceId ?? 'no-trace';
            this.logger.log(`Completed job id=${job.id} name=${job.name}`);
        });
        this.worker.on('failed',(job:Job,err)=>{
            const traceId = (job.returnvalue as any)?.traceId ??(job.data as any)?.traceId?? 'no-trace';
            this.logger.log(`Failed job id=${job?.id} name=${job?.name}`,err.stack);
        })

        this.logger.log(`TestWorker is Listening on queue: ${QUEUE_NAMES.TEST} `);

    }
    async onModuleDestroy(){
        if(this.worker){
            await this.worker.close();
        }
    }

}
