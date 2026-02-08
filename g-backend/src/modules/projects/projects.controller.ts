import {Body,Controller,Post,Req} from '@nestjs/common';
import type{Request} from 'express';
import {ProjectService} from './projects.service';
import {CreateProjectDto} from './dto/create-project.dto';

@Controller('projects')
export class ProjectController{
    constructor (private readonly projects:ProjectService){}

    @Post()
    async create(@Body() dto:CreateProjectDto,@Req() req:Request){
        const traceId = (req as any).traceId;
        const project = await this.projects.createProject(dto.repoUrl, dto.name);
        return {ProjectId: project.id, traceId};
    }
}

