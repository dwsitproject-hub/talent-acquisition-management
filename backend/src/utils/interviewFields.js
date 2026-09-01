/**
 * Helpers for FPTK interview fields.
 * Interviewer matching must be exact — partial first/last name matches
 * attach the wrong user (e.g. "Dani Tamin" → "Dani Gordon").
 */

function buildInterviewerLookupWhere(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return null;

  const parts = name.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ');

  const or = [{ email: { equals: name, mode: 'insensitive' } }];

  if (lastName) {
    or.push({
      AND: [
        { firstName: { equals: firstName, mode: 'insensitive' } },
        { lastName: { equals: lastName, mode: 'insensitive' } },
      ],
    });
    // Some records store the full name in firstName only.
    or.push({ firstName: { equals: name, mode: 'insensitive' } });
  }

  return { OR: or };
}

/**
 * Persist interview date/time as a UTC calendar value so the same
 * YYYY-MM-DD and HH:mm round-trip regardless of server timezone.
 * Returns null when no date is provided.
 */
function parseInterviewScheduledAt(dateStr, timeStr) {
  const date = String(dateStr || '').trim();
  if (!date) return null;

  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const time = String(timeStr || '00:00').trim();
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})/);
  const hours = timeMatch ? Number(timeMatch[1]) : 0;
  const minutes = timeMatch ? Number(timeMatch[2]) : 0;

  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  }

  const fallback = new Date(date);
  if (Number.isNaN(fallback.getTime())) return null;
  fallback.setUTCHours(hours, minutes, 0, 0);
  return fallback;
}

module.exports = {
  buildInterviewerLookupWhere,
  parseInterviewScheduledAt,
};
