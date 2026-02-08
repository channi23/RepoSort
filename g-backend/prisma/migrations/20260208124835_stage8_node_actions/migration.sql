-- CreateEnum
CREATE TYPE "NodeActionType" AS ENUM ('REFACTOR', 'HARDEN', 'ADD_TESTS');

-- CreateEnum
CREATE TYPE "NodeActionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "NodeAction" (
    "id" TEXT NOT NULL,
    "type" "NodeActionType" NOT NULL,
    "status" "NodeActionStatus" NOT NULL DEFAULT 'QUEUED',
    "projectId" TEXT NOT NULL,
    "graphSnapshotId" TEXT NOT NULL,
    "repoSnapshotId" TEXT NOT NULL,
    "planId" TEXT,
    "runId" TEXT,
    "prompt" TEXT NOT NULL,
    "selectedNodeIds" JSONB NOT NULL,
    "error" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeAction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "NodeAction" ADD CONSTRAINT "NodeAction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
