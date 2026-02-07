/*
  Warnings:

  - You are about to drop the column `managerId` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `department` on the `EmployeeJobAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `jobTitle` on the `EmployeeJobAssignment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,employeeId]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,employeeId,jobRoleId]` on the table `EmployeeJobAssignment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `departmentCategoryId` to the `Department` table without a default value. This is not possible if the table is not empty.
  - Added the required column `divisionId` to the `Department` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jobRoleId` to the `EmployeeJobAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_managerId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_defaultPropertyId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Employee_employmentDetails_idx";

-- DropIndex
DROP INDEX IF EXISTS "Employee_managerId_idx";

-- DropIndex
DROP INDEX IF EXISTS "EmployeeJobAssignment_tenantId_employeeId_id_key";

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "costCenter" TEXT,
ADD COLUMN     "departmentCategoryId" TEXT NOT NULL,
ADD COLUMN     "divisionId" TEXT NOT NULL,
ADD COLUMN     "laborBudget" DECIMAL(65,30),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "reportingGroupId" TEXT;

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "managerId",
ADD COLUMN     "employeeId" TEXT;

-- AlterTable
ALTER TABLE "EmployeeJobAssignment" DROP COLUMN IF EXISTS "department",
DROP COLUMN IF EXISTS "jobTitle",
ADD COLUMN     "hourlyRate" DOUBLE PRECISION,
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobRoleId" TEXT NOT NULL,
ADD COLUMN     "overtimeEligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "payType" TEXT NOT NULL DEFAULT 'hourly',
ADD COLUMN     "payrollGroup" TEXT,
ADD COLUMN     "salaryAmount" DOUBLE PRECISION,
ADD COLUMN     "tipPoolEligible" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "UserRoleAssignmentUserIdRoleIdPropertyIdDepartmentIdKey";

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRole" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "jobCategoryId" TEXT NOT NULL,
    "description" TEXT,
    "payCode" TEXT,
    "skillClassification" TEXT,
    "unionClassification" TEXT,
    "flsaStatus" TEXT,
    "certificationRequirements" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RulePackage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceText" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,

    CONSTRAINT "RulePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompiledRule" (
    "id" TEXT NOT NULL,
    "rulePackageId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL DEFAULT 'ERROR',
    "params" JSONB NOT NULL DEFAULT '{}',
    "citations" JSONB,
    "clarifications" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompiledRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleValidationResult" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rulePackageId" TEXT NOT NULL,
    "employeeId" TEXT,
    "dateStart" TIMESTAMP(3) NOT NULL,
    "dateEnd" TIMESTAMP(3) NOT NULL,
    "violations" JSONB NOT NULL DEFAULT '[]',
    "violationCount" INTEGER NOT NULL DEFAULT 0,
    "hasErrors" BOOLEAN NOT NULL DEFAULT false,
    "hasWarnings" BOOLEAN NOT NULL DEFAULT false,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runBy" TEXT,

    CONSTRAINT "RuleValidationResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Division_tenantId_idx" ON "Division"("tenantId");

-- CreateIndex
CREATE INDEX "Division_propertyId_idx" ON "Division"("propertyId");

-- CreateIndex
CREATE INDEX "Division_createdAt_idx" ON "Division"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Division_tenantId_propertyId_id_key" ON "Division"("tenantId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "DepartmentCategory_tenantId_idx" ON "DepartmentCategory"("tenantId");

-- CreateIndex
CREATE INDEX "DepartmentCategory_createdAt_idx" ON "DepartmentCategory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentCategory_tenantId_name_key" ON "DepartmentCategory"("tenantId", "name");

-- CreateIndex
CREATE INDEX "JobCategory_tenantId_idx" ON "JobCategory"("tenantId");

-- CreateIndex
CREATE INDEX "JobCategory_createdAt_idx" ON "JobCategory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobCategory_tenantId_name_key" ON "JobCategory"("tenantId", "name");

-- CreateIndex
CREATE INDEX "JobRole_tenantId_idx" ON "JobRole"("tenantId");

-- CreateIndex
CREATE INDEX "JobRole_propertyId_idx" ON "JobRole"("propertyId");

-- CreateIndex
CREATE INDEX "JobRole_departmentId_idx" ON "JobRole"("departmentId");

-- CreateIndex
CREATE INDEX "JobRole_jobCategoryId_idx" ON "JobRole"("jobCategoryId");

-- CreateIndex
CREATE INDEX "JobRole_payCode_idx" ON "JobRole"("payCode");

-- CreateIndex
CREATE INDEX "JobRole_skillClassification_idx" ON "JobRole"("skillClassification");

-- CreateIndex
CREATE INDEX "JobRole_flsaStatus_idx" ON "JobRole"("flsaStatus");

-- CreateIndex
CREATE INDEX "JobRole_createdAt_idx" ON "JobRole"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_tenantId_propertyId_departmentId_id_key" ON "JobRole"("tenantId", "propertyId", "departmentId", "id");

-- CreateIndex
CREATE INDEX "JobAssignment_tenantId_idx" ON "JobAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "JobAssignment_propertyId_idx" ON "JobAssignment"("propertyId");

-- CreateIndex
CREATE INDEX "JobAssignment_jobRoleId_idx" ON "JobAssignment"("jobRoleId");

-- CreateIndex
CREATE INDEX "JobAssignment_createdAt_idx" ON "JobAssignment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobAssignment_tenantId_propertyId_jobRoleId_id_key" ON "JobAssignment"("tenantId", "propertyId", "jobRoleId", "id");

-- CreateIndex
CREATE INDEX "RulePackage_tenantId_idx" ON "RulePackage"("tenantId");

-- CreateIndex
CREATE INDEX "RulePackage_propertyId_idx" ON "RulePackage"("propertyId");

-- CreateIndex
CREATE INDEX "RulePackage_status_idx" ON "RulePackage"("status");

-- CreateIndex
CREATE INDEX "RulePackage_createdAt_idx" ON "RulePackage"("createdAt");

-- CreateIndex
CREATE INDEX "RulePackage_publishedAt_idx" ON "RulePackage"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RulePackage_tenantId_name_version_key" ON "RulePackage"("tenantId", "name", "version");

-- CreateIndex
CREATE INDEX "CompiledRule_rulePackageId_idx" ON "CompiledRule"("rulePackageId");

-- CreateIndex
CREATE INDEX "CompiledRule_ruleId_idx" ON "CompiledRule"("ruleId");

-- CreateIndex
CREATE INDEX "CompiledRule_enabled_idx" ON "CompiledRule"("enabled");

-- CreateIndex
CREATE INDEX "RuleValidationResult_tenantId_idx" ON "RuleValidationResult"("tenantId");

-- CreateIndex
CREATE INDEX "RuleValidationResult_rulePackageId_idx" ON "RuleValidationResult"("rulePackageId");

-- CreateIndex
CREATE INDEX "RuleValidationResult_employeeId_idx" ON "RuleValidationResult"("employeeId");

-- CreateIndex
CREATE INDEX "RuleValidationResult_dateStart_idx" ON "RuleValidationResult"("dateStart");

-- CreateIndex
CREATE INDEX "RuleValidationResult_dateEnd_idx" ON "RuleValidationResult"("dateEnd");

-- CreateIndex
CREATE INDEX "RuleValidationResult_runAt_idx" ON "RuleValidationResult"("runAt");

-- CreateIndex
CREATE INDEX "RuleValidationResult_violationCount_idx" ON "RuleValidationResult"("violationCount");

-- CreateIndex
CREATE INDEX "RuleValidationResult_hasErrors_idx" ON "RuleValidationResult"("hasErrors");

-- CreateIndex
CREATE INDEX "Department_divisionId_idx" ON "Department"("divisionId");

-- CreateIndex
CREATE INDEX "Department_departmentCategoryId_idx" ON "Department"("departmentCategoryId");

-- CreateIndex
CREATE INDEX "Department_managerId_idx" ON "Department"("managerId");

-- CreateIndex
CREATE INDEX "Department_costCenter_idx" ON "Department"("costCenter");

-- CreateIndex
CREATE INDEX "Department_location_idx" ON "Department"("location");

-- CreateIndex
CREATE INDEX "Employee_employeeId_idx" ON "Employee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_tenantId_employeeId_key" ON "Employee"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "EmployeeJobAssignment_jobRoleId_idx" ON "EmployeeJobAssignment"("jobRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeJobAssignment_tenantId_employeeId_jobRoleId_key" ON "EmployeeJobAssignment"("tenantId", "employeeId", "jobRoleId");

-- CreateIndex
DO $$
BEGIN
    IF to_regclass('"EmployeeReport"') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS "EmployeeReport_createdAt_idx" ON "EmployeeReport"("createdAt");
    END IF;
END $$;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentCategory" ADD CONSTRAINT "DepartmentCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCategory" ADD CONSTRAINT "JobCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_departmentCategoryId_fkey" FOREIGN KEY ("departmentCategoryId") REFERENCES "DepartmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_jobCategoryId_fkey" FOREIGN KEY ("jobCategoryId") REFERENCES "JobCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeJobAssignment" ADD CONSTRAINT "EmployeeJobAssignment_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RulePackage" ADD CONSTRAINT "RulePackage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RulePackage" ADD CONSTRAINT "RulePackage_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RulePackage" ADD CONSTRAINT "RulePackage_publishedBy_fkey" FOREIGN KEY ("publishedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompiledRule" ADD CONSTRAINT "CompiledRule_rulePackageId_fkey" FOREIGN KEY ("rulePackageId") REFERENCES "RulePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleValidationResult" ADD CONSTRAINT "RuleValidationResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleValidationResult" ADD CONSTRAINT "RuleValidationResult_rulePackageId_fkey" FOREIGN KEY ("rulePackageId") REFERENCES "RulePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleValidationResult" ADD CONSTRAINT "RuleValidationResult_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleValidationResult" ADD CONSTRAINT "RuleValidationResult_runBy_fkey" FOREIGN KEY ("runBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
