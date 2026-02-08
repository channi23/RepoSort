-- CreateTable
CREATE TABLE "VerificationReport" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "graphSnapshotId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "residualRiskCount" INTEGER NOT NULL,
    "reportPath" TEXT NOT NULL,

    CONSTRAINT "VerificationReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationReport_runId_key" ON "VerificationReport"("runId");

-- CreateIndex
CREATE INDEX "VerificationReport_projectId_createdAt_idx" ON "VerificationReport"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "VerificationReport" ADD CONSTRAINT "VerificationReport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationReport" ADD CONSTRAINT "VerificationReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationReport" ADD CONSTRAINT "VerificationReport_graphSnapshotId_fkey" FOREIGN KEY ("graphSnapshotId") REFERENCES "GraphSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
