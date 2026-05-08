const cron = require('node-cron');
const logger = require('../utils/logger');
const { runOnboardingJoinReminderCycle } = require('../services/onboardingReminderService');

let scheduledTask = null;

/**
 * Hourly at minute 0 UTC. Runs are idempotent via OnboardingJoinReminderDispatch.
 */
function startOnboardingJoinReminderScheduler() {
  if (process.env.ENABLE_ONBOARDING_JOIN_REMINDERS === 'false') {
    logger.info('[onboardingJoinReminderJob] Scheduler disabled (ENABLE_ONBOARDING_JOIN_REMINDERS=false)');
    return;
  }

  scheduledTask = cron.schedule(
    '0 * * * *',
    async () => {
      try {
        const summary = await runOnboardingJoinReminderCycle();
        logger.info('[onboardingJoinReminderJob] Hourly cycle completed', summary);
      } catch (err) {
        logger.error('[onboardingJoinReminderJob] Hourly cycle failed', {
          message: err.message,
          stack: err.stack,
        });
      }
    },
    { timezone: 'UTC' }
  );

  logger.info('[onboardingJoinReminderJob] Cron registered: 0 * * * * (UTC)');

  if (process.env.ONBOARDING_REMINDER_RUN_ON_START === 'true') {
    setTimeout(async () => {
      try {
        const summary = await runOnboardingJoinReminderCycle();
        logger.info('[onboardingJoinReminderJob] Startup run completed', summary);
      } catch (err) {
        logger.error('[onboardingJoinReminderJob] Startup run failed', {
          message: err.message,
          stack: err.stack,
        });
      }
    }, 5000);
  }
}

function stopOnboardingJoinReminderScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('[onboardingJoinReminderJob] Cron stopped');
  }
}

module.exports = {
  startOnboardingJoinReminderScheduler,
  stopOnboardingJoinReminderScheduler,
};
