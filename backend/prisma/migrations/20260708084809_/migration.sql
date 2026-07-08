/*
  Warnings:

  - A unique constraint covering the columns `[indiamartQueryId]` on the table `Lead` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "indiamartQueryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_indiamartQueryId_key" ON "Lead"("indiamartQueryId");
