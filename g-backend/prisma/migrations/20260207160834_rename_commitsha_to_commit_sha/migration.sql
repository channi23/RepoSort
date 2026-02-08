/*
  Warnings:

  - You are about to drop the column `commitsha` on the `RepoSnapshot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RepoSnapshot" DROP COLUMN "commitsha",
ADD COLUMN     "commitSha" TEXT;
