-- CreateEnum
CREATE TYPE "WfmPlanningPeriodType" AS ENUM ('WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "WfmSchedulePeriod" ADD COLUMN     "planningTemplateId" TEXT;

-- CreateTable
CREATE TABLE "WfmScheduleSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "templates" JSONB NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WfmScheduleSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WfmScheduleSettings_tenantId_propertyId_key" ON "WfmScheduleSettings"("tenantId", "propertyId");

-- CreateIndex
CREATE INDEX "WfmScheduleSettings_tenantId_idx" ON "WfmScheduleSettings"("tenantId");

-- CreateIndex
CREATE INDEX "WfmScheduleSettings_propertyId_idx" ON "WfmScheduleSettings"("propertyId");

-- CreateIndex
CREATE INDEX "WfmScheduleSettings_createdAt_idx" ON "WfmScheduleSettings"("createdAt");

-- AddForeignKey
ALTER TABLE "WfmScheduleSettings" ADD CONSTRAINT "WfmScheduleSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmScheduleSettings" ADD CONSTRAINT "WfmScheduleSettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmScheduleSettings" ADD CONSTRAINT "WfmScheduleSettings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
