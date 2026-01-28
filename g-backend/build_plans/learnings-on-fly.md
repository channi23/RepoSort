# Okay these are the things that i found out while i am building this

## Infrastructure intallation observations
- okay BULLmq is on top of redis where it is used to manage q's for my backend
- execa is used to run commands and thing that we actually interact with os level which cannot be done with the node js correctly.
- okay also i have ioredis installed as may be bridge type of thing that can help to communicate with the redis services

## Setting up redis queue for pushing and also creating dummy workers 
- first , under the queue module and inside again /queues i have created a file queue.name.ts. which is for defining the jobs that can be actually pushed from the user side
- now inside the queue dir, i have created a controller file for testing and actually for having an endpoint for pushing tasks into queue
- now coming to the  queue.module.ts i have connect the BullMq to redis, registered atleast one queue with nestjs
- why we need queue.module.ts? as this is where redis becomes available to the app, this is where queue becomes injectable, basically this module is the bridge between Nestjs and redis-backed queues
- we have test.worker.ts where we have the worker, which considers the jobs which are actually there in the queue, also have logs and it is done with the help of Logger
- for more info i or you can expore the files( you is iff you are reading this else this is purely for me )

