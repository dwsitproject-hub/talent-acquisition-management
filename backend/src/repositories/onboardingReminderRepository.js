const prisma = require('../config/database');
const { parseMulti, isTaSiteRole, TA_SITE_FIXED_AREA } = require('../utils/hrbpScope');

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
 * Canonical FPTK area label: HO | Site | '' (unknown).
 * Matches dashboard/summary conventions (area column, then location fallback).
 */
function resolveNormalizedArea(fptk) {
  const area = (fptk?.area || '').trim();
  if (area) {
    const lower = area.toLowerCase();
    if (lower === 'ho') return 'HO';
    if (lower === 'site') return 'Site';
    return area;
  }
  const loc = (fptk?.location || '').trim().toLowerCase();
  if (loc === 'head office' || loc === 'ho') return 'HO';
  if (loc === 'site') return 'Site';
  return '';
}

/**
 * Roles that should receive onboarding join reminders for this FPTK area.
 * - HO: TA_HO, HRBP
 * - Site: TA_SITE, TA_HO, HRBP
 * Unknown area defaults to HO recipients.
 */
function reminderRolesForArea(normalizedArea) {
  if (String(normalizedArea || '').toLowerCase() === 'site') {
    return ['TA_SITE', 'TA_HO', 'HRBP'];
  }
  return ['TA_HO', 'HRBP'];
}

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

function listIncludes(values, target) {
  const t = norm(target);
  if (!t) return false;
  return values.some((v) => norm(v) === t);
}

function areasForUser(user) {
  if (isTaSiteRole(user?.role)) return [TA_SITE_FIXED_AREA];
  return parseMulti(user?.area);
}

/**
 * HRBP / TA_SITE: only users whose PT / Area / Area Detail scope covers the FPTK.
 * TA_HO: all active users with that role (org-wide).
 */
function userMatchesFptkScope(user, fptk) {
  if (user.role === 'TA_HO') return true;

  const pts = parseMulti(user.pt);
  const areas = areasForUser(user);
  const details = parseMulti(user.areaDetail);
  if (!pts.length || !areas.length || !details.length) return false;

  return (
    listIncludes(pts, fptk?.pt) &&
    listIncludes(areas, resolveNormalizedArea(fptk)) &&
    listIncludes(details, fptk?.areaDetail)
  );
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
          pt: true,
          area: true,
          areaDetail: true,
          location: true,
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

/**
 * Resolve reminder recipient emails for a position (FPTK).
 * @param {{ pt?: string|null, area?: string|null, areaDetail?: string|null, location?: string|null }} fptk
 * @returns {Promise<string[]>}
 */
async function findReminderRecipientEmails(fptk) {
  const normalizedArea = resolveNormalizedArea(fptk);
  const roles = reminderRolesForArea(normalizedArea);

  const users = await prisma.user.findMany({
    where: {
      role: { in: roles },
      isActive: true,
    },
    select: {
      email: true,
      role: true,
      pt: true,
      area: true,
      areaDetail: true,
    },
  });

  const emails = users
    .filter((u) => userMatchesFptkScope(u, fptk))
    .map((u) => String(u.email || '').trim())
    .filter(Boolean);

  return [...new Set(emails)];
}

/** @deprecated Use findReminderRecipientEmails(fptk) */
async function findTaTeamEmails() {
  return findReminderRecipientEmails({ area: 'HO' });
}

module.exports = {
  startOfUtcDay,
  addUtcDays,
  resolveNormalizedArea,
  reminderRolesForArea,
  findApplicationsJoiningBetween,
  findDispatch,
  createDispatch,
  markEmailSent,
  findReminderRecipientEmails,
  findTaTeamEmails,
};
