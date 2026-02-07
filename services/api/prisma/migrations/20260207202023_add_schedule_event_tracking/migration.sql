/*
  Warnings:

  - You are about to drop the column `managerId` on the `Employee` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_managerId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_defaultPropertyId_fkey";

-- DropIndex
DROP INDEX "Employee_employmentDetails_idx";

-- DropIndex
DROP INDEX "Employee_managerId_idx";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "managerId";

-- AlterTable
ALTER TABLE "WfmSwapRequest" ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "WfmScheduleEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "schedulePeriodId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "byUserId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WfmScheduleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WfmScheduleEvent_schedulePeriodId_at_idx" ON "WfmScheduleEvent"("schedulePeriodId", "at");

-- CreateIndex
CREATE INDEX "WfmScheduleEvent_tenantId_idx" ON "WfmScheduleEvent"("tenantId");

-- CreateIndex
CREATE INDEX "WfmScheduleEvent_propertyId_idx" ON "WfmScheduleEvent"("propertyId");

-- CreateIndex
CREATE INDEX "WfmScheduleEvent_byUserId_idx" ON "WfmScheduleEvent"("byUserId");

-- CreateIndex
CREATE INDEX "EmployeeReport_createdAt_idx" ON "EmployeeReport"("createdAt");

-- AddForeignKey
ALTER TABLE "WfmScheduleEvent" ADD CONSTRAINT "WfmScheduleEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmScheduleEvent" ADD CONSTRAINT "WfmScheduleEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmScheduleEvent" ADD CONSTRAINT "WfmScheduleEvent_schedulePeriodId_fkey" FOREIGN KEY ("schedulePeriodId") REFERENCES "WfmSchedulePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmScheduleEvent" ADD CONSTRAINT "WfmScheduleEvent_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
