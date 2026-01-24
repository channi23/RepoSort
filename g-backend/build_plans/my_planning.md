# My Tasks that i need to do sequentially 

The backend i am gonna do usually need modules, so frist step that i am gonna do  is create the needed modules in high level, so that i can know the full archiecture and the flow of the 
applcation that we are gonna build

## The Required modules are:

- auth - where we can the user github login 
- where we can get the project that he wants to you know structure or change without needing the IDE
- ingestion- this is where we take the snap-shot of teh repo that we need so that we can change the thing is the given repo like deep-copy
- graph - this is the part where we need to have the logic for the visualization of the reo or the project to be specific, like what are the dependencies and what are the files we have in
our dir
- analysis - we use gemini to find the security flaws or any vulnerabilities that are currently present in the vibe-coded project
- planning - it is where the user prompt in a sandbox env to change some of the code-base without needing the ide
- runs - changes take place
- diff - previous and current code diff
- NodeAction
- Governance
- Artifacts

## Set-up infra that we need

- postgres +Prisma(DB)
- Redis+BullMQ(queues/workers)
- sandboxService(clone+run commands in isolated folders)
- StorageService(store artifacts:patch/report/json)
- request/run trace id logging


