-- CreateEnum
CREATE TYPE "WfmScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WfmRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELED');

-- CreateEnum
CREATE TYPE "WfmAvailabilityType" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'PREFERRED');

-- CreateTable
CREATE TABLE "WfmSchedulePeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "WfmScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WfmSchedulePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WfmShiftPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "schedulePeriodId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "isOpenShift" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WfmShiftPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WfmShiftAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "shiftPlanId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WfmShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WfmAvailability" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "type" "WfmAvailabilityType",
    "recurrenceRule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WfmAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WfmSwapRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "requestorEmployeeId" TEXT NOT NULL,
    "fromShiftPlanId" TEXT NOT NULL,
    "toEmployeeId" TEXT,
    "status" "WfmRequestStatus" NOT NULL DEFAULT 'PENDING',
    "managerUserId" TEXT,
    "decisionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WfmSwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WfmPublishEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "schedulePeriodId" TEXT NOT NULL,
    "publishedByUserId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WfmPublishEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WfmSchedulePeriod_tenantId_propertyId_startDate_idx" ON "WfmSchedulePeriod"("tenantId", "propertyId", "startDate");

-- CreateIndex
CREATE INDEX "WfmSchedulePeriod_tenantId_idx" ON "WfmSchedulePeriod"("tenantId");

-- CreateIndex
CREATE INDEX "WfmSchedulePeriod_propertyId_idx" ON "WfmSchedulePeriod"("propertyId");

-- CreateIndex
CREATE INDEX "WfmSchedulePeriod_createdAt_idx" ON "WfmSchedulePeriod"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WfmSchedulePeriod_tenantId_propertyId_startDate_version_key" ON "WfmSchedulePeriod"("tenantId", "propertyId", "startDate", "version");

-- CreateIndex
CREATE INDEX "WfmShiftPlan_schedulePeriodId_startDateTime_idx" ON "WfmShiftPlan"("schedulePeriodId", "startDateTime");

-- CreateIndex
CREATE INDEX "WfmShiftPlan_tenantId_propertyId_departmentId_idx" ON "WfmShiftPlan"("tenantId", "propertyId", "departmentId");

-- CreateIndex
CREATE INDEX "WfmShiftPlan_tenantId_idx" ON "WfmShiftPlan"("tenantId");

-- CreateIndex
CREATE INDEX "WfmShiftPlan_propertyId_idx" ON "WfmShiftPlan"("propertyId");

-- CreateIndex
CREATE INDEX "WfmShiftPlan_departmentId_idx" ON "WfmShiftPlan"("departmentId");

-- CreateIndex
CREATE INDEX "WfmShiftPlan_jobRoleId_idx" ON "WfmShiftPlan"("jobRoleId");

-- CreateIndex
CREATE INDEX "WfmShiftPlan_createdAt_idx" ON "WfmShiftPlan"("createdAt");

-- CreateIndex
CREATE INDEX "WfmShiftAssignment_employeeId_assignedAt_idx" ON "WfmShiftAssignment"("employeeId", "assignedAt");

-- CreateIndex
CREATE INDEX "WfmShiftAssignment_tenantId_idx" ON "WfmShiftAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "WfmShiftAssignment_propertyId_idx" ON "WfmShiftAssignment"("propertyId");

-- CreateIndex
CREATE INDEX "WfmShiftAssignment_shiftPlanId_idx" ON "WfmShiftAssignment"("shiftPlanId");

-- CreateIndex
CREATE INDEX "WfmShiftAssignment_createdAt_idx" ON "WfmShiftAssignment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WfmShiftAssignment_shiftPlanId_employeeId_key" ON "WfmShiftAssignment"("shiftPlanId", "employeeId");

-- CreateIndex
CREATE INDEX "WfmAvailability_employeeId_date_idx" ON "WfmAvailability"("employeeId", "date");

-- CreateIndex
CREATE INDEX "WfmAvailability_tenantId_idx" ON "WfmAvailability"("tenantId");

-- CreateIndex
CREATE INDEX "WfmAvailability_propertyId_idx" ON "WfmAvailability"("propertyId");

-- CreateIndex
CREATE INDEX "WfmAvailability_createdAt_idx" ON "WfmAvailability"("createdAt");

-- CreateIndex
CREATE INDEX "WfmSwapRequest_tenantId_propertyId_status_idx" ON "WfmSwapRequest"("tenantId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "WfmSwapRequest_requestorEmployeeId_idx" ON "WfmSwapRequest"("requestorEmployeeId");

-- CreateIndex
CREATE INDEX "WfmSwapRequest_fromShiftPlanId_idx" ON "WfmSwapRequest"("fromShiftPlanId");

-- CreateIndex
CREATE INDEX "WfmSwapRequest_createdAt_idx" ON "WfmSwapRequest"("createdAt");

-- CreateIndex
CREATE INDEX "WfmPublishEvent_schedulePeriodId_publishedAt_idx" ON "WfmPublishEvent"("schedulePeriodId", "publishedAt");

-- CreateIndex
CREATE INDEX "WfmPublishEvent_tenantId_idx" ON "WfmPublishEvent"("tenantId");

-- CreateIndex
CREATE INDEX "WfmPublishEvent_propertyId_idx" ON "WfmPublishEvent"("propertyId");

-- CreateIndex
CREATE INDEX "WfmPublishEvent_createdAt_idx" ON "WfmPublishEvent"("createdAt");


-- AddForeignKey
ALTER TABLE "WfmSchedulePeriod" ADD CONSTRAINT "WfmSchedulePeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmSchedulePeriod" ADD CONSTRAINT "WfmSchedulePeriod_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmSchedulePeriod" ADD CONSTRAINT "WfmSchedulePeriod_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmShiftPlan" ADD CONSTRAINT "WfmShiftPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmShiftPlan" ADD CONSTRAINT "WfmShiftPlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmShiftPlan" ADD CONSTRAINT "WfmShiftPlan_schedulePeriodId_fkey" FOREIGN KEY ("schedulePeriodId") REFERENCES "WfmSchedulePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmShiftPlan" ADD CONSTRAINT "WfmShiftPlan_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmShiftPlan" ADD CONSTRAINT "WfmShiftPlan_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmShiftAssignment" ADD CONSTRAINT "WfmShiftAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmShiftAssignment" ADD CONSTRAINT "WfmShiftAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmShiftAssignment" ADD CONSTRAINT "WfmShiftAssignment_shiftPlanId_fkey" FOREIGN KEY ("shiftPlanId") REFERENCES "WfmShiftPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmShiftAssignment" ADD CONSTRAINT "WfmShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmShiftAssignment" ADD CONSTRAINT "WfmShiftAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmAvailability" ADD CONSTRAINT "WfmAvailability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmAvailability" ADD CONSTRAINT "WfmAvailability_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmAvailability" ADD CONSTRAINT "WfmAvailability_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmSwapRequest" ADD CONSTRAINT "WfmSwapRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmSwapRequest" ADD CONSTRAINT "WfmSwapRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmSwapRequest" ADD CONSTRAINT "WfmSwapRequest_requestorEmployeeId_fkey" FOREIGN KEY ("requestorEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmSwapRequest" ADD CONSTRAINT "WfmSwapRequest_fromShiftPlanId_fkey" FOREIGN KEY ("fromShiftPlanId") REFERENCES "WfmShiftPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmSwapRequest" ADD CONSTRAINT "WfmSwapRequest_toEmployeeId_fkey" FOREIGN KEY ("toEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmSwapRequest" ADD CONSTRAINT "WfmSwapRequest_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmPublishEvent" ADD CONSTRAINT "WfmPublishEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmPublishEvent" ADD CONSTRAINT "WfmPublishEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmPublishEvent" ADD CONSTRAINT "WfmPublishEvent_schedulePeriodId_fkey" FOREIGN KEY ("schedulePeriodId") REFERENCES "WfmSchedulePeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WfmPublishEvent" ADD CONSTRAINT "WfmPublishEvent_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
