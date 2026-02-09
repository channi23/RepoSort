-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PolicyDecision" AS ENUM ('ALLOW', 'REQUIRE_APPROVAL', 'DENY');

-- AlterEnum
ALTER TYPE "NodeActionStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "nodeActionId" TEXT,
    "planId" TEXT,
    "runId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedByRole" TEXT,
    "reasons" JSONB NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "traceId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "decision" "PolicyDecision" NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalRequest_projectId_status_createdAt_idx" ON "ApprovalRequest"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_nodeActionId_idx" ON "ApprovalRequest"("nodeActionId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_planId_idx" ON "ApprovalRequest"("planId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_runId_idx" ON "ApprovalRequest"("runId");

-- CreateIndex
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_nodeActionId_fkey" FOREIGN KEY ("nodeActionId") REFERENCES "NodeAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
