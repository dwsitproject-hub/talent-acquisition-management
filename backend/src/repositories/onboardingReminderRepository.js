const prisma = require('../config/database');

/** @param {Date} date */
function startOfUtcDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** @param {Date} utcDayStart start of UTC day */
function addUtcDays(utcDayStart, n) {
  const x = new Date(utcDayStart.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/**
 * Applications whose joinDate falls on the calendar day [utcDayStart, utcDayEndExclusive) in UTC.
 * Source of join date: Application.joinDate (set at MCU / position level).
 */
async function findApplicationsJoiningBetween(utcDayStart, utcDayEndExclusive) {
  return prisma.application.findMany({
    where: {
      joinDate: {
        gte: utcDayStart,
        lt: utcDayEndExclusive,
      },
      status: {
        notIn: ['REJECTED', 'WITHDRAWN'],
      },
    },
    include: {
      candidate: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      fptk: {
        select: {
          department: true,
          positionTitle: true,
          position: true,
        },
      },
    },
  });
}

async function findDispatch(applicationId, offsetDays, anchorJoinDate) {
  return prisma.onboardingJoinReminderDispatch.findUnique({
    where: {
      applicationId_offsetDays_anchorJoinDate: {
        applicationId,
        offsetDays,
        anchorJoinDate,
      },
    },
  });
}

async function createDispatch({ applicationId, offsetDays, anchorJoinDate, emailSentAt }) {
  return prisma.onboardingJoinReminderDispatch.create({
    data: {
      applicationId,
      offsetDays,
      anchorJoinDate,
      emailSentAt,
    },
  });
}

async function markEmailSent(dispatchId, emailSentAt) {
  return prisma.onboardingJoinReminderDispatch.update({
    where: { id: dispatchId },
    data: { emailSentAt },
  });
}

async function findTaTeamEmails() {
  const users = await prisma.user.findMany({
    where: {
      role: 'TA_HO',
      isActive: true,
    },
    select: { email: true },
  });
  return users.map((u) => String(u.email || '').trim()).filter(Boolean);
}

module.exports = {
  startOfUtcDay,
  addUtcDays,
  findApplicationsJoiningBetween,
  findDispatch,
  createDispatch,
  markEmailSent,
  findTaTeamEmails,
};
