-- AddColumn to User
ALTER TABLE "User" ADD COLUMN "locale" TEXT;
ALTER TABLE "User" ADD COLUMN "timezone" TEXT;

-- AddColumn to Tenant for tenant-level settings
ALTER TABLE "Tenant" ADD COLUMN "weekStartDay" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN "defaultLocale" TEXT NOT NULL DEFAULT 'en-US';
ALTER TABLE "Tenant" ADD COLUMN "defaultTimezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "Tenant" ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'USD';
