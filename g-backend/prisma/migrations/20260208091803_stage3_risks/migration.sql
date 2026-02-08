-- CreateEnum
CREATE TYPE "RiskType" AS ENUM ('STRUCTURAL', 'SECURITY');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "graphSnapshotId" TEXT NOT NULL,
    "type" "RiskType" NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ruleId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskOnNode" (
    "riskId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,

    CONSTRAINT "RiskOnNode_pkey" PRIMARY KEY ("riskId","nodeId")
);

-- CreateIndex
CREATE INDEX "RiskOnNode_nodeId_idx" ON "RiskOnNode"("nodeId");

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_graphSnapshotId_fkey" FOREIGN KEY ("graphSnapshotId") REFERENCES "GraphSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskOnNode" ADD CONSTRAINT "RiskOnNode_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskOnNode" ADD CONSTRAINT "RiskOnNode_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
