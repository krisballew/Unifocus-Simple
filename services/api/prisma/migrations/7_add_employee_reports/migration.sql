-- Create EmployeeReport join table for multiple manager relationships
CREATE TABLE IF NOT EXISTS "EmployeeReport" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EmployeeReport_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeReport_employeeId_managerId_key" ON "EmployeeReport"("employeeId", "managerId");
CREATE INDEX IF NOT EXISTS "EmployeeReport_tenantId_idx" ON "EmployeeReport"("tenantId");
CREATE INDEX IF NOT EXISTS "EmployeeReport_employeeId_idx" ON "EmployeeReport"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeReport_managerId_idx" ON "EmployeeReport"("managerId");

-- Backfill existing single-manager assignments into the join table
INSERT INTO "EmployeeReport" ("id", "tenantId", "employeeId", "managerId")
SELECT gen_random_uuid()::text, "tenantId", "id", "managerId"
FROM "Employee"
WHERE "managerId" IS NOT NULL
ON CONFLICT DO NOTHING;
