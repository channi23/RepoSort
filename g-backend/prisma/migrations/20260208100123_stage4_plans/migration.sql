-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "PlanStepType" AS ENUM ('REFACTOR', 'HARDEN', 'ADD_TESTS', 'CLEANUP', 'DOCS');

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "graphSnapshotId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "selectedNodeIds" JSONB NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanStep" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "PlanStepType" NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT,
    "targetNodeIds" JSONB NOT NULL,
    "meta" JSONB,

    CONSTRAINT "PlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Plan_projectId_createdAt_idx" ON "Plan"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Plan_graphSnapshotId_idx" ON "Plan"("graphSnapshotId");

-- CreateIndex
CREATE INDEX "PlanStep_planId_order_idx" ON "PlanStep"("planId", "order");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_graphSnapshotId_fkey" FOREIGN KEY ("graphSnapshotId") REFERENCES "GraphSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanStep" ADD CONSTRAINT "PlanStep_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
