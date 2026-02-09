import { Controller, Patch, Post, Delete, Param, Body, Logger } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';

@Controller('nodes')
export class NodeController {
    private readonly logger = new Logger(NodeController.name);

    constructor(private readonly prisma: PrismaService) { }

    @Patch(':id')
    async updateNode(@Param('id') id: string, @Body() data: { label?: string; meta?: any }) {
        this.logger.log(`Updating node ${id}: ${JSON.stringify(data)}`);
        return this.prisma.node.update({
            where: { id },
            data,
        });
    }

    @Post()
    async createNode(@Body() data: { graphSnapshotId: string; type: any; label: string; parentId: string }) {
        const { parentId, ...rest } = data;
        this.logger.log(`Creating node under ${parentId}: ${JSON.stringify(rest)}`);

        return this.prisma.$transaction(async (tx) => {
            const node = await tx.node.create({ data: rest });
            await tx.edge.create({
                data: {
                    graphSnapshotId: data.graphSnapshotId,
                    type: 'CONTAINS',
                    fromNodeId: parentId,
                    toNodeId: node.id,
                },
            });
            return node;
        });
    }

    @Delete(':id')
    async deleteNode(@Param('id') id: string) {
        this.logger.log(`Deleting node ${id}`);
        return this.prisma.node.delete({
            where: { id },
        });
    }
}
