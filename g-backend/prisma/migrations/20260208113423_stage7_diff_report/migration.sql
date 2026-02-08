-- CreateTable
CREATE TABLE "DiffReport" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "beforeGraphSnapshotId" TEXT NOT NULL,
    "afterGraphSnapshotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nodesAddedCount" INTEGER NOT NULL DEFAULT 0,
    "nodesRemovedCount" INTEGER NOT NULL DEFAULT 0,
    "edgesAddedCount" INTEGER NOT NULL DEFAULT 0,
    "edgesRemovedCount" INTEGER NOT NULL DEFAULT 0,
    "beforeRiskCount" INTEGER NOT NULL DEFAULT 0,
    "afterRiskCount" INTEGER NOT NULL DEFAULT 0,
    "riskDelta" INTEGER NOT NULL DEFAULT 0,
    "reportPath" TEXT NOT NULL,

    CONSTRAINT "DiffReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiffReport_runId_key" ON "DiffReport"("runId");

-- AddForeignKey
ALTER TABLE "DiffReport" ADD CONSTRAINT "DiffReport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiffReport" ADD CONSTRAINT "DiffReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
