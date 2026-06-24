const prisma = require('../config/database');
const logger = require('../utils/logger');
const emailService = require('./emailService');
const onboardingReminderRepository = require('../repositories/onboardingReminderRepository');

const REMINDER_OFFSET_DAYS = [14, 7];

function candidateDisplayName(application) {
  const u = application.candidate?.user;
  if (u) {
    const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    if (n) return n;
  }
  return 'Candidate';
}

function formatJoinDateUtc(joinDate) {
  const d = new Date(joinDate);
  return d.toLocaleDateString('en-CA', { timeZone: 'UTC' });
}

/**
 * Resolve email send outcome: real SMTP send, or "vacuous success" when there is no TA mailbox (stops retry loops).
 * @param {string[]} recipients
 * @param {object} payload
 * @returns {Promise<{ emailSentAt: Date | null }>}
 */
async function resolveEmailDispatch(recipients, payload) {
  if (!recipients.length) {
    logger.warn('[onboardingReminder] No active TA_HO emails; marking email leg as satisfied to avoid retry loops');
    return { emailSentAt: new Date() };
  }
  const result = await emailService.sendOnboardingJoinReminderToTaTeam(payload);
  if (result.success) {
    return { emailSentAt: new Date() };
  }
  if (result.skipRetry) {
    logger.warn('[onboardingReminder] Email skipped (no SMTP or no recipients); closing dispatch leg to avoid infinite retries', {
      error: result.error,
    });
    return { emailSentAt: new Date() };
  }
  return { emailSentAt: null };
}

/**
 * @param {import('@prisma/client').Application & { candidate: any, fptk: any }} application
 * @param {number} offsetDays
 */
async function processApplicationOffset(application, offsetDays) {
  if (!application.joinDate) {
    return { status: 'skipped', reason: 'no_join_date' };
  }

  const anchorJoinDate = onboardingReminderRepository.startOfUtcDay(application.joinDate);
  const existing = await onboardingReminderRepository.findDispatch(
    application.id,
    offsetDays,
    anchorJoinDate
  );

  const department = String(application.fptk?.department || '—');
  const candidateName = candidateDisplayName(application);
  const joinDateFormatted = formatJoinDateUtc(application.joinDate);

  const recipients = await onboardingReminderRepository.findTaTeamEmails();

  const emailPayload = {
    recipients,
    candidateName,
    joinDateFormatted,
    department,
    offsetDays,
  };

  if (existing) {
    if (existing.emailSentAt) {
      return { status: 'skipped', reason: 'already_complete' };
    }
    const { emailSentAt } = await resolveEmailDispatch(recipients, emailPayload);
    if (emailSentAt) {
      await onboardingReminderRepository.markEmailSent(existing.id, emailSentAt);
      return { status: 'email_retried', emailSent: true };
    }
    return { status: 'email_retried', emailSent: false };
  }

  try {
    await prisma.notification.create({
      data: {
        userId: application.candidate.userId,
        type: 'IN_APP',
        channel: 'in_app',
        subject:
          offsetDays === 14
            ? 'Reminder: your join date is in 2 weeks'
            : 'Reminder: your join date is in 1 week',
        message: `Your scheduled join date with ${department} is ${joinDateFormatted}. If you have questions, contact the TA team.`,
        data: {
          kind: 'ONBOARDING_JOIN_REMINDER',
          applicationId: application.id,
          offsetDays,
          joinDate: application.joinDate.toISOString(),
          department,
        },
        isSent: true,
        sentAt: new Date(),
      },
    });
  } catch (err) {
    logger.error('[onboardingReminder] In-app notification failed', {
      applicationId: application.id,
      message: err.message,
      stack: err.stack,
    });
    throw err;
  }

  const { emailSentAt } = await resolveEmailDispatch(recipients, emailPayload);

  await onboardingReminderRepository.createDispatch({
    applicationId: application.id,
    offsetDays,
    anchorJoinDate,
    emailSentAt,
  });

  return { status: 'processed', emailSent: !!emailSentAt };
}

/**
 * One idempotent cycle: for today (UTC), process 14-day and 7-day-before-join windows.
 * @returns {Promise<object>}
 */
async function runOnboardingJoinReminderCycle() {
  const now = new Date();
  const todayStart = onboardingReminderRepository.startOfUtcDay(now);

  const summary = {
    offsets: REMINDER_OFFSET_DAYS,
    todayUtc: todayStart.toISOString(),
    processed: 0,
    skipped: 0,
    emailRetried: 0,
    errors: 0,
  };

  for (const offsetDays of REMINDER_OFFSET_DAYS) {
    const targetJoinDay = onboardingReminderRepository.addUtcDays(todayStart, offsetDays);
    const nextDay = onboardingReminderRepository.addUtcDays(targetJoinDay, 1);

    const applications = await onboardingReminderRepository.findApplicationsJoiningBetween(
      targetJoinDay,
      nextDay
    );

    logger.info('[onboardingReminder] Window scan', {
      offsetDays,
      targetJoinDayUtc: targetJoinDay.toISOString(),
      count: applications.length,
    });

    for (const application of applications) {
      try {
        const result = await processApplicationOffset(application, offsetDays);
        if (result.status === 'skipped') {
          summary.skipped += 1;
        } else if (result.status === 'email_retried') {
          summary.emailRetried += 1;
          summary.processed += 1;
        } else {
          summary.processed += 1;
        }
      } catch (err) {
        summary.errors += 1;
        logger.error('[onboardingReminder] Item failed', {
          applicationId: application.id,
          offsetDays,
          message: err.message,
          stack: err.stack,
        });
      }
    }
  }

  return summary;
}

module.exports = {
  runOnboardingJoinReminderCycle,
  processApplicationOffset,
  REMINDER_OFFSET_DAYS,
};
