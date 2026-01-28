import {Controller,Get} from '@nestjs/common';
import {SandBoxService} from './sandbox.service';

@Controller('sandbox')
export class SandboxTestController{
    constructor(private readonly sandbox:SandBoxService){}

    @Get('test')
    async test(){
        const projectId = 'RepoSort123';
        const runId = 'Repo1';
        
        const repoDir = this.sandbox.ensureRepoDir(projectId,runId);

        const res = await this.sandbox.runCommand({
             cwd: repoDir,
             cmd :'node',
             args: ['-v'],
             timeoutMs:10_000,

        });
        return {repoDir, ...res};

    }

}
