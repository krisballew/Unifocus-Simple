-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "currency" TEXT;
ALTER TABLE "User" ADD COLUMN "defaultPropertyId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultPropertyId_fkey" FOREIGN KEY ("defaultPropertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
