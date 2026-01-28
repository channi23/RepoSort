import {Injectable} from "@nestjs/common";
import * as fs from 'fs';
import * as path from 'path';

@Injectable()

export class StorageService{
    private readonly root:string;
    
    //kay we getting the address joined to the root for the artifcats
    constructor(){
        const configured = process.env.ARTIFACTS_ROOT || '../artifacts';
        this.root = path.resolve(process.cwd(),configured);
    }
    //root 
    getRunRoot(projectId:string,runId:string){
        return path.join(this.root,projectId,runId);
    }
    private ensureDir(dirPath:string){
        fs.mkdirSync(dirPath, {recursive:true});
    }
    //write the content-text to the relative path
    writeText(projectId:string,runId:string,relativePath:string,content:string){
        const base = this.getRunRoot(projectId,runId);
        const fullPath = path.join(base,relativePath);
        this.ensureDir(path.dirname(fullPath));
        fs.writeFileSync(fullPath,content,'utf-8');
        return  fullPath;
    }
    writeJson(projectId:string,runId:string,relativePath:string,obj:unknown){
        return this.writeText(projectId,runId,relativePath,JSON.stringify(obj,null,2));
    }

}
