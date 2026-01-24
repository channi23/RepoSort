# What My Brain is processing about this project

## Modules creation

okay the modules creating actually made my visual step illustratiin more simpler and now i can say that i know in detail what will happen in the backend, would like
to learn a lot on the go, and i will documenting what i will learn in the other dir, which may be if u want to read can understand the dir name and read it when
needed.. 


if you would also like to know why we have the modules and what are its purposes:
here i am gonna provide the context

### first i am gonna go with these dir's 

- db - for talking to the postgres
- queue - for running long jobs in the background
- sandbox - safe repo/build/text execution
- storage - save patches/reports/artifacts
- common - shared utilities(logging, middleware,helpers)
- modules - feature/pipeline API surfaces

#### Now coming to what we have in the modules

- auth - who is the user and what are they allowed to do
- projects - represent a repo as long-lived proj
- ingestion - turn a git repo into a safe versioned snapshot
- graph - convert repo into graph semantics
- analysis - find architectural and security risks in the graph
- planning - convert user intent(like prompts) into plan
- runs - execute the prepared plans safely and track'em
- diffs - explain and show what changed before vs after
- node-action - ui-triggered safe actions on  the selected nodes
- governance - enforce persmissons, approvals, and safety rules
- artifacts - package and expose outputs (patches,reports,exports)

### How i connected the postgres with prisma

I have connected the postgres, where it is basically running on docker , where if you want to set up the project, i mean this project just run the  command

- docker compose up -d (it will pull all the requirements that are defined in the projects docker-compose.yml)
- as we have the thing set up, i have installed  the prisma client from using npm , you can find it in the official docs, just follow the steps, like choose postgres
while follwing the docs
- create a schema inside the prisma.schema file which stays under the prisma dir which comes when we ran prisma init in the root dir
- just create the table with required column names and run npx prisma migrate dev --name init
- also run npx prisma generate
- remember you need to change the prisma-client in the provider to prisma-client-js and also give correct path for you postgres in the .env file



