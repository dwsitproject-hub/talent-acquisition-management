-- AlterTable
ALTER TABLE "users" ADD COLUMN "oidcSub" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_oidcSub_key" ON "users"("oidcSub");
