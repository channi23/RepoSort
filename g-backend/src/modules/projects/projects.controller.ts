import { Body, Controller, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ProjectService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { PrismaService } from '../../db/prisma.service';
import { SnapshotStatus } from '@prisma/client';
import { BaseController } from '../../common/controllers/base.controller';

@Controller('projects')
export class ProjectController extends BaseController {
    constructor(
        private readonly projects: ProjectService,
        private readonly prisma: PrismaService,
    ) { super(); }

    @Post()
    async create(@Body() dto: CreateProjectDto, @Req() req: Request) {
        const traceId = this.getTraceId(req);
        const project = await this.projects.createProject(dto.repoUrl, dto.name);
        return { ProjectId: project.id, traceId };
    }

    @Get(':id/status')
    async getStatus(@Param('id') id: string) {
        const repoSnapshot = await this.prisma.repoSnapshot.findFirst({
            where: { projectId: id },
            orderBy: { createdAt: 'desc' },
        });

        const graphSnapshot = await this.prisma.graphSnapshot.findFirst({
            where: { projectId: id },
            orderBy: { createdAt: 'desc' },
        });

        let status: 'INGESTING' | 'ANALYZING' | 'READY' | 'FAILED' = 'INGESTING';
        let error: string | null = null;
        let details: string | null = null;

        if (!repoSnapshot) {
            status = 'INGESTING';
            details = 'Waiting for ingestion to start...';
        } else if (repoSnapshot.status === SnapshotStatus.FAILED) {
            status = 'FAILED';
            error = repoSnapshot.error || 'Ingestion failed';
        } else if (repoSnapshot.status === SnapshotStatus.PENDING || repoSnapshot.status === SnapshotStatus.PROCESSING) {
            status = 'INGESTING';
        } else {
            // Repo Ingestion is COMPLETED
            if (!graphSnapshot) {
                status = 'ANALYZING'; // Waiting for graph build to start
            } else if (graphSnapshot.status === SnapshotStatus.FAILED) {
                status = 'FAILED';
                error = graphSnapshot.error || 'Graph build failed';
            } else if (graphSnapshot.status === SnapshotStatus.PENDING || graphSnapshot.status === SnapshotStatus.PROCESSING) {
                status = 'ANALYZING';
            } else {
                status = 'READY';
            }
        }

        return {
            status,
            error,
            details,
            repoSnapshotId: repoSnapshot?.id,
            graphSnapshotId: graphSnapshot?.id
        };
    }
}

