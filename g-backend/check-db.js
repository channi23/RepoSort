const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany();
  console.log('--- Projects ---');
  console.log(projects);

  const snapshots = await prisma.repoSnapshot.findMany();
  console.log('--- Repo Snapshots ---');
  console.log(snapshots);
  
  const graphSnapshots = await prisma.graphSnapshot.findMany();
  console.log('--- Graph Snapshots ---');
  console.log(graphSnapshots);
}

main().catch(console.error).finally(() => prisma.$disconnect());
