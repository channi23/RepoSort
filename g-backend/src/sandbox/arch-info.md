# Info about the code inside this repo

## We are goin to create some files for some work and that is:

###  sanbox.service.ts 
we need this file for our backend to touch the filesystem and run shell commands.
our backend will eventually 
- clone git repo's 
- install dependencies
- run builds/tests
- modify code
- generate patches

all os-level things will go through

###  sanbox.module.ts

makes the sandbox service/engine injectable and reusable across the backend/App

### sandbox-test.controller.ts

A smoke test to prove that sandbox works before real pipelines exist
