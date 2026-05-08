/**
 * Run onboarding join-date reminders once (14d / 7d windows for UTC "today").
 * Use from cron or CI: node scripts/runOnboardingReminders.js
 *
 * Requires DATABASE_URL. Optional: same SMTP_* vars as the API for TA emails.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const prisma = require('../src/config/database');
const logger = require('../src/utils/logger');
const { runOnboardingJoinReminderCycle } = require('../src/services/onboardingReminderService');

async function main() {
  try {
    await prisma.$connect();
    const summary = await runOnboardingJoinReminderCycle();
    logger.info('[runOnboardingReminders] Done', summary);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (err) {
    logger.error('[runOnboardingReminders] Failed', { message: err.message, stack: err.stack });
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
