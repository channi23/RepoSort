-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "RepoSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sandboxRepoPath" TEXT NOT NULL,
    "branch" TEXT,
    "commitsha" TEXT,
    "isMonorepo" BOOLEAN NOT NULL DEFAULT false,
    "packManager" TEXT,
    "runtime" TEXT,
    "testFramework" TEXT,
    "fileTreeJson" JSONB,
    "configJson" JSONB,

    CONSTRAINT "RepoSnapshot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RepoSnapshot" ADD CONSTRAINT "RepoSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
