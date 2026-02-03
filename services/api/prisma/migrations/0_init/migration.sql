-- CreateEnum
CREATE TYPE "UserRoleAssignmentUserIdRoleIdPropertyIdDepartmentIdKey" AS ENUM ('unique');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "departmentId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "propertyId" TEXT,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "externalId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hireDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeJobAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeJobAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Punch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Punch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exception" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "userRoleAssignmentId" TEXT,
    "propertyId" TEXT,
    "departmentId" TEXT,
    "employeeId" TEXT,
    "employeeJobAssignmentId" TEXT,
    "scheduleId" TEXT,
    "shiftId" TEXT,
    "punchId" TEXT,
    "exceptionId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "changes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_createdAt_idx" ON "Tenant"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Property_tenantId_id_key" ON "Property"("tenantId", "id");

-- CreateIndex
CREATE INDEX "Property_tenantId_idx" ON "Property"("tenantId");

-- CreateIndex
CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_propertyId_id_key" ON "Department"("tenantId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");

-- CreateIndex
CREATE INDEX "Department_propertyId_idx" ON "Department"("propertyId");

-- CreateIndex
CREATE INDEX "Department_createdAt_idx" ON "Department"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_propertyId_idx" ON "User"("propertyId");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_createdAt_idx" ON "Role"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleAssignment_userId_roleId_propertyId_departmentId_key" ON "UserRoleAssignment"("userId", "roleId", "propertyId", "departmentId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_tenantId_idx" ON "UserRoleAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_userId_idx" ON "UserRoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_propertyId_idx" ON "UserRoleAssignment"("propertyId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_departmentId_idx" ON "UserRoleAssignment"("departmentId");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_createdAt_idx" ON "UserRoleAssignment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_tenantId_propertyId_id_key" ON "Employee"("tenantId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "Employee_tenantId_idx" ON "Employee"("tenantId");

-- CreateIndex
CREATE INDEX "Employee_propertyId_idx" ON "Employee"("propertyId");

-- CreateIndex
CREATE INDEX "Employee_email_idx" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "Employee_createdAt_idx" ON "Employee"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeJobAssignment_tenantId_employeeId_id_key" ON "EmployeeJobAssignment"("tenantId", "employeeId", "id");

-- CreateIndex
CREATE INDEX "EmployeeJobAssignment_tenantId_idx" ON "EmployeeJobAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "EmployeeJobAssignment_employeeId_idx" ON "EmployeeJobAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeJobAssignment_startDate_idx" ON "EmployeeJobAssignment"("startDate");

-- CreateIndex
CREATE INDEX "EmployeeJobAssignment_createdAt_idx" ON "EmployeeJobAssignment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_tenantId_propertyId_employeeId_id_key" ON "Schedule"("tenantId", "propertyId", "employeeId", "id");

-- CreateIndex
CREATE INDEX "Schedule_tenantId_idx" ON "Schedule"("tenantId");

-- CreateIndex
CREATE INDEX "Schedule_propertyId_idx" ON "Schedule"("propertyId");

-- CreateIndex
CREATE INDEX "Schedule_employeeId_idx" ON "Schedule"("employeeId");

-- CreateIndex
CREATE INDEX "Schedule_startDate_idx" ON "Schedule"("startDate");

-- CreateIndex
CREATE INDEX "Schedule_createdAt_idx" ON "Schedule"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_tenantId_scheduleId_id_key" ON "Shift"("tenantId", "scheduleId", "id");

-- CreateIndex
CREATE INDEX "Shift_tenantId_idx" ON "Shift"("tenantId");

-- CreateIndex
CREATE INDEX "Shift_scheduleId_idx" ON "Shift"("scheduleId");

-- CreateIndex
CREATE INDEX "Shift_createdAt_idx" ON "Shift"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Punch_tenantId_employeeId_id_key" ON "Punch"("tenantId", "employeeId", "id");

-- CreateIndex
CREATE INDEX "Punch_tenantId_idx" ON "Punch"("tenantId");

-- CreateIndex
CREATE INDEX "Punch_employeeId_idx" ON "Punch"("employeeId");

-- CreateIndex
CREATE INDEX "Punch_shiftId_idx" ON "Punch"("shiftId");

-- CreateIndex
CREATE INDEX "Punch_timestamp_idx" ON "Punch"("timestamp");

-- CreateIndex
CREATE INDEX "Punch_type_idx" ON "Punch"("type");

-- CreateIndex
CREATE INDEX "Punch_createdAt_idx" ON "Punch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Exception_tenantId_employeeId_id_key" ON "Exception"("tenantId", "employeeId", "id");

-- CreateIndex
CREATE INDEX "Exception_tenantId_idx" ON "Exception"("tenantId");

-- CreateIndex
CREATE INDEX "Exception_employeeId_idx" ON "Exception"("employeeId");

-- CreateIndex
CREATE INDEX "Exception_date_idx" ON "Exception"("date");

-- CreateIndex
CREATE INDEX "Exception_status_idx" ON "Exception"("status");

-- CreateIndex
CREATE INDEX "Exception_createdAt_idx" ON "Exception"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_propertyId_idx" ON "AuditLog"("propertyId");

-- CreateIndex
CREATE INDEX "AuditLog_departmentId_idx" ON "AuditLog"("departmentId");

-- CreateIndex
CREATE INDEX "AuditLog_employeeId_idx" ON "AuditLog"("employeeId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeJobAssignment" ADD CONSTRAINT "EmployeeJobAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Punch" ADD CONSTRAINT "Punch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Punch" ADD CONSTRAINT "Punch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Punch" ADD CONSTRAINT "Punch_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exception" ADD CONSTRAINT "Exception_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userRoleAssignmentId_fkey" FOREIGN KEY ("userRoleAssignmentId") REFERENCES "UserRoleAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_employeeJobAssignmentId_fkey" FOREIGN KEY ("employeeJobAssignmentId") REFERENCES "EmployeeJobAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_punchId_fkey" FOREIGN KEY ("punchId") REFERENCES "Punch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "Exception"("id") ON DELETE SET NULL ON UPDATE CASCADE;
