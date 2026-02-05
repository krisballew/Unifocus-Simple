-- Add organizational structure fields to Employee table
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "managerId" TEXT;

-- Add foreign key constraint for manager relationship
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for manager lookups
CREATE INDEX IF NOT EXISTS "Employee_managerId_idx" ON "Employee"("managerId");
