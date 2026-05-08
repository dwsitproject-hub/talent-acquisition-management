-- CreateTable
CREATE TABLE "onboarding_join_reminder_dispatches" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "offsetDays" INTEGER NOT NULL,
    "anchorJoinDate" DATE NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_join_reminder_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_join_reminder_dispatches_applicationId_offsetDays_anchorJoinDate_key" ON "onboarding_join_reminder_dispatches"("applicationId", "offsetDays", "anchorJoinDate");

-- CreateIndex
CREATE INDEX "onboarding_join_reminder_dispatches_applicationId_idx" ON "onboarding_join_reminder_dispatches"("applicationId");

-- CreateIndex
CREATE INDEX "onboarding_join_reminder_dispatches_anchorJoinDate_idx" ON "onboarding_join_reminder_dispatches"("anchorJoinDate");

-- AddForeignKey
ALTER TABLE "onboarding_join_reminder_dispatches" ADD CONSTRAINT "onboarding_join_reminder_dispatches_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (applications.joinDate — query due reminders by join calendar day)
CREATE INDEX IF NOT EXISTS "applications_joinDate_idx" ON "applications"("joinDate");
