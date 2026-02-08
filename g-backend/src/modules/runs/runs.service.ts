import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../db/prisma.service';

@Injectable()
export class RunsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRun(runId: string) {
    const run = await this.prisma.run.findUnique({
      where: { id: runId },
      include: { patch: true },
    });
    if (!run) throw new NotFoundException(`Run not found: ${runId}`);
    return run;
  }
}
