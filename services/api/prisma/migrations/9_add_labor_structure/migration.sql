-- Add JobRole model for labor structure (Department -> JobRole hierarchy with master category)
CREATE TABLE "JobRole" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "masterCategory" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys for JobRole
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE;
ALTER TABLE "JobRole" ADD CONSTRAINT "JobRole_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE;

-- Create indexes for JobRole
CREATE INDEX "JobRole_tenantId_idx" ON "JobRole"("tenantId");
CREATE INDEX "JobRole_propertyId_idx" ON "JobRole"("propertyId");
CREATE INDEX "JobRole_departmentId_idx" ON "JobRole"("departmentId");
CREATE INDEX "JobRole_masterCategory_idx" ON "JobRole"("masterCategory");
CREATE INDEX "JobRole_createdAt_idx" ON "JobRole"("createdAt");

-- Add unique constraint
CREATE UNIQUE INDEX "JobRole_tenantId_propertyId_departmentId_id_key" ON "JobRole"("tenantId", "propertyId", "departmentId", "id");

-- Add employeeId column to Employee table
ALTER TABLE "Employee" ADD COLUMN "employeeId" TEXT;

-- Create unique index for employeeId per tenant
CREATE UNIQUE INDEX "Employee_tenantId_employeeId_key" ON "Employee"("tenantId", "employeeId") WHERE "employeeId" IS NOT NULL;

-- Add employeeId index
CREATE INDEX "Employee_employeeId_idx" ON "Employee"("employeeId");

-- Recreate EmployeeJobAssignment table with new structure
ALTER TABLE "EmployeeJobAssignment" RENAME TO "EmployeeJobAssignment_old";

CREATE TABLE "EmployeeJobAssignment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "jobRoleId" TEXT NOT NULL,
  "payType" TEXT NOT NULL DEFAULT 'hourly',
  "hourlyRate" DOUBLE PRECISION,
  "salaryAmount" DOUBLE PRECISION,
  "payrollGroup" TEXT,
  "overtimeEligible" BOOLEAN NOT NULL DEFAULT true,
  "tipPoolEligible" BOOLEAN NOT NULL DEFAULT false,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmployeeJobAssignment_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys for EmployeeJobAssignment
ALTER TABLE "EmployeeJobAssignment" ADD CONSTRAINT "EmployeeJobAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE;
ALTER TABLE "EmployeeJobAssignment" ADD CONSTRAINT "EmployeeJobAssignment_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "JobRole"("id") ON DELETE CASCADE;

-- Create indexes for EmployeeJobAssignment
CREATE INDEX "EmployeeJobAssignment_tenantId_idx" ON "EmployeeJobAssignment"("tenantId");
CREATE INDEX "EmployeeJobAssignment_employeeId_idx" ON "EmployeeJobAssignment"("employeeId");
CREATE INDEX "EmployeeJobAssignment_jobRoleId_idx" ON "EmployeeJobAssignment"("jobRoleId");
CREATE INDEX "EmployeeJobAssignment_startDate_idx" ON "EmployeeJobAssignment"("startDate");
CREATE INDEX "EmployeeJobAssignment_createdAt_idx" ON "EmployeeJobAssignment"("createdAt");

-- Create unique constraint
CREATE UNIQUE INDEX "EmployeeJobAssignment_tenantId_employeeId_jobRoleId_key" ON "EmployeeJobAssignment"("tenantId", "employeeId", "jobRoleId");

-- Drop old table
DROP TABLE "EmployeeJobAssignment_old";
