-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NodeActionType" ADD VALUE 'OPTIMIZE';
ALTER TYPE "NodeActionType" ADD VALUE 'RENAME';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NodeType" ADD VALUE 'LAYER';
ALTER TYPE "NodeType" ADD VALUE 'SUBSYSTEM';
ALTER TYPE "NodeType" ADD VALUE 'COMPONENT';
ALTER TYPE "NodeType" ADD VALUE 'HOOK';
ALTER TYPE "NodeType" ADD VALUE 'CLASS';
ALTER TYPE "NodeType" ADD VALUE 'HANDLER';
ALTER TYPE "NodeType" ADD VALUE 'CONTEXT';

-- AlterTable
ALTER TABLE "GraphSnapshot" ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" "SnapshotStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "autoApply" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "RepoSnapshot" ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" "SnapshotStatus" NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "NodeAction" ADD CONSTRAINT "NodeAction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
