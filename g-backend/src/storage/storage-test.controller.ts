import {Controller,Get,Post} from "@nestjs/common";
import {StorageService} from './storage.service';

@Controller('storage')
export class StorageTestController{
    constructor(private readonly storage:StorageService){}
    
    @Get('test')
    async test(){
        const projectId = 'vamshi-dummy-1';
        const runId = 'vamshi-1';

        const jsonPath = this.storage.writeJson(projectId,runId,'reports/sample.json',{
            ok:true,
            ts:new Date().toISOString(),
        });
        const diffPath = this.storage.writeText(projectId,runId,'patch.diff','diff --git a/x b/x \n');
        return {jsonPath,diffPath};
    }
}
