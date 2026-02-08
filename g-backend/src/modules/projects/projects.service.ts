import {Injectable } from '@nestjs/common';
import {PrismaService} from '../../db/prisma.service';

@Injectable()
export class ProjectService{
    constructor(private readonly prisma:PrismaService){}
    
    createProject(repoUrl:string, name?:string){
        return this.prisma.project.create({
            data:{repoUrl,name},
        });
    }
    getProject(projectId:string){
        return this.prisma.project.findUnique({where:{id:projectId}});
    }
}

