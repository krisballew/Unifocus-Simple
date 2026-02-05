-- Add employment details JSON field to Employee table
ALTER TABLE "Employee" ADD COLUMN "employmentDetails" JSONB;

-- Add index on employmentDetails for future querying
CREATE INDEX "Employee_employmentDetails_idx" ON "Employee" USING GIN ("employmentDetails");
