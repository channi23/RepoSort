/*
  Warnings:

  - You are about to drop the column `packManager` on the `RepoSnapshot` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('PROJECT', 'DIR', 'FILE', 'MODULE', 'FUNCTION', 'DEPENDENCY', 'CONFIG', 'SERVICE');

-- CreateEnum
CREATE TYPE "EdgeType" AS ENUM ('CONTAINS', 'IMPORTS', 'DEPENDS_ON', 'CALLS');

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RepoSnapshot" DROP COLUMN "packManager",
ADD COLUMN     "packageManager" TEXT;

-- CreateTable
CREATE TABLE "GraphSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "repoSnapshotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nodeCount" INTEGER NOT NULL DEFAULT 0,
    "edgeCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GraphSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "graphSnapshotId" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "label" TEXT NOT NULL,
    "path" TEXT,
    "meta" JSONB,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edge" (
    "id" TEXT NOT NULL,
    "graphSnapshotId" TEXT NOT NULL,
    "type" "EdgeType" NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "meta" JSONB,

    CONSTRAINT "Edge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Node_graphSnapshotId_idx" ON "Node"("graphSnapshotId");

-- CreateIndex
CREATE INDEX "Edge_graphSnapshotId_idx" ON "Edge"("graphSnapshotId");

-- AddForeignKey
ALTER TABLE "GraphSnapshot" ADD CONSTRAINT "GraphSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphSnapshot" ADD CONSTRAINT "GraphSnapshot_repoSnapshotId_fkey" FOREIGN KEY ("repoSnapshotId") REFERENCES "RepoSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_graphSnapshotId_fkey" FOREIGN KEY ("graphSnapshotId") REFERENCES "GraphSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_graphSnapshotId_fkey" FOREIGN KEY ("graphSnapshotId") REFERENCES "GraphSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
