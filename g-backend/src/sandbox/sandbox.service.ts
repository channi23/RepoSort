import {Injectable} from '@nestjs/common';
import {execa} from 'execa';
import * as fs from 'fs';
import * as path from 'path';

export type CmdResult ={
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
};

@Injectable()
export class SandBoxService{
    private readonly root:string ;
    private readonly allowedCmds = new Set(['git','node','npm','yarn','pnpm']);

    constructor(){
        //need to convert into absolute path
        const configured = process.env.SANDBOX_ROOT || '../sandboxes';
        this.root = path.resolve(process.cwd(),configured);
    }
    getBasePath(projectId:string,snapshotOrRunId: string){
        //produces SANDBOX_ROOT/projectId/runId

        return path.join(this.root,projectId,snapshotOrRunId);
    }
    getRepoPath(projectId:string,snapshotOrRunId:string){
        // for getting the repo path produces :  SANDBOX_ROOT/projectId/runId/repo
        return path.join(this.getBasePath(projectId,snapshotOrRunId),'repo');
    }

    ensureDir(dirPath: string){
        fs.mkdirSync(dirPath,{recursive:true});
    }
    
    ensureRepoDir(projectId:string, snapshotOrRunId:string){
        const repoPath = this.getRepoPath(projectId,snapshotOrRunId);
        this.ensureDir(repoPath);
        return repoPath;
    }
    private assertAllowed(cmd:string){
        if(!this.allowedCmds.has(cmd)){
            throw new Error(`Command now allwed in the sandbox: "${cmd}"`);
        }
    }
    async runCommand(opts:{
        cwd: string;
        cmd: string;
        args?: string[];
        timeoutMs?: number;
        env?: Record<string,string>;
    }):Promise<CmdResult>{
        const {cwd,cmd, args=[],timeoutMs=60_000,env={}}= opts;

        this.assertAllowed(cmd);
        this.ensureDir(cwd);

        try{
            const p = await execa(cmd,args,{
                cwd,
                env:{...process.env, ...env},
                timeout: timeoutMs,
                stdio:'pipe',
            });
            return {
                stdout: p.stdout ?? '',
                stderr: p.stderr ?? '',
                exitCode: p.exitCode ?? 0,
                timedOut: false,

            };
        } catch(err:any){
            const timedOut = Boolean(err?.timedOut);
            return {
                stdout: err?.stdout ?? '',
                stderr: err?.stderr ?? String(err?.message ?? err),
                exitCode: err?.exitCode=='number' ? err.exitCode:1,
                timedOut,
                
            };

        }
    }

}



