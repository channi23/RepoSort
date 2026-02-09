-- CreateEnum
CREATE TYPE "ExecutionSource" AS ENUM ('GEMINI', 'FALLBACK');

-- CreateEnum
CREATE TYPE "StepName" AS ENUM ('INGEST', 'BUILD_GRAPH', 'ANALYZE', 'CREATE_PLAN', 'APPLY_PLAN', 'VERIFY', 'DIFF', 'EXPORT');

-- CreateTable
CREATE TABLE "StepExecution" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT,
    "nodeActionId" TEXT,
    "stepName" "StepName" NOT NULL,
    "source" "ExecutionSource" NOT NULL,
    "model" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StepExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StepExecution_projectId_createdAt_idx" ON "StepExecution"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "StepExecution_runId_createdAt_idx" ON "StepExecution"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "StepExecution_nodeActionId_createdAt_idx" ON "StepExecution"("nodeActionId", "createdAt");

-- CreateIndex
CREATE INDEX "StepExecution_stepName_createdAt_idx" ON "StepExecution"("stepName", "createdAt");

-- AddForeignKey
ALTER TABLE "StepExecution" ADD CONSTRAINT "StepExecution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
