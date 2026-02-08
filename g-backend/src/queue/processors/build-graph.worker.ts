import {Injectable,OnModuleInit,OnModuleDestroy,Logger} from '@nestjs/common';
import {Worker,Job} from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';

import {PrismaService} from  '../../db/prisma.service';
import {QUEUE_NAMES} from '../queues/queue.names';

@Injectable()
export class BuildGraphWorker implements OnModuleInit,OnModuleDestroy{
    private readonly logger = new Logger(BuildGraphWorker.name);
    private worker!:Worker;

    constructor(private readonly prisma:PrismaService){}

    async onModuleInit(){
        this.worker = new Worker(
            QUEUE_NAMES.BUILD_GRAPH,
            async (job:Job)=>this.handle(job),
            {
                connection:{host:'localhost',port:6379},
            },
        );
        this.logger.log(`BuildGraphWorker listening on queue: ${QUEUE_NAMES.BUILD_GRAPH}`);
    }
    async onModuleDestroy(){
        await this.worker?.close();
    }

    //logic
    private async handle(job: Job) {
    const { projectId, repoSnapshotId, traceId } = job.data;

    this.logger.log(
      `[traceId=${traceId}] build graph start project=${projectId} snapshot=${repoSnapshotId}`,
    );

    // Load RepoSnapshot
    const snapshot = await this.prisma.repoSnapshot.findUnique({
      where: { id: repoSnapshotId },
    });

    if (!snapshot) {
      throw new Error(`RepoSnapshot not found: ${repoSnapshotId}`);
    }

    const repoRoot = snapshot.sandboxRepoPath;

    // Create GraphSnapshot
    const graph = await this.prisma.graphSnapshot.create({
      data: {
        projectId,
        repoSnapshotId,
      },
    });

    // Create PROJECT node
    const projectNode = await this.prisma.node.create({
      data: {
        graphSnapshotId: graph.id,
        type: 'PROJECT',
        label: path.basename(repoRoot),
        path: '/',
      },
    });

    let nodeCount = 1;
    let edgeCount = 0;

    //Walk filesystem (DIR + FILE)
    const walk = async (dirPath: string, parentNodeId: string) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // skip .git and node_modules for now
        if (entry.name === '.git' || entry.name === 'node_modules') continue;

        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.relative(repoRoot, fullPath);

        if (entry.isDirectory()) {
          const dirNode = await this.prisma.node.create({
            data: {
              graphSnapshotId: graph.id,
              type: 'DIR',
              label: entry.name,
              path: relPath,
            },
          });

          await this.prisma.edge.create({
            data: {
              graphSnapshotId: graph.id,
              type: 'CONTAINS',
              fromNodeId: parentNodeId,
              toNodeId: dirNode.id,
            },
          });

          nodeCount++;
          edgeCount++;

          await walk(fullPath, dirNode.id);
        }

        if (entry.isFile()) {
          const fileNode = await this.prisma.node.create({
            data: {
              graphSnapshotId: graph.id,
              type: 'FILE',
              label: entry.name,
              path: relPath,
            },
          });

          await this.prisma.edge.create({
            data: {
              graphSnapshotId: graph.id,
              type: 'CONTAINS',
              fromNodeId: parentNodeId,
              toNodeId: fileNode.id,
            },
          });

          nodeCount++;
          edgeCount++;
        }
      }
    };

    await walk(repoRoot, projectNode.id);

    // update counts
    await this.prisma.graphSnapshot.update({
      where: { id: graph.id },
      data: {
        nodeCount,
        edgeCount,
      },
    });

    this.logger.log(
      `[traceId=${traceId}] build graph done graphSnapshotId=${graph.id} nodes=${nodeCount} edges=${edgeCount}`,
    );

    return { graphSnapshotId: graph.id, nodeCount, edgeCount };
  }


}

