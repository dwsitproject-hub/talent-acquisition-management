const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Build SMTP transport from environment. Returns null if email is not configured.
 * @returns {import('nodemailer').Transporter | null}
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return null;
  }
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass: pass || '' } : undefined,
  });
}

/**
 * Send TA Team onboarding join reminder (14d / 7d before candidate join date).
 * @param {Object} params
 * @param {string[]} params.recipients - TA user emails
 * @param {string} params.candidateName
 * @param {string} params.joinDateFormatted - e.g. YYYY-MM-DD
 * @param {string} params.department - assigned department (FPTK)
 * @param {number} params.offsetDays - 14 or 7
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendOnboardingJoinReminderToTaTeam({
  recipients,
  candidateName,
  joinDateFormatted,
  department,
  offsetDays,
}) {
  const emails = (recipients || []).map((e) => String(e || '').trim()).filter(Boolean);
  if (emails.length === 0) {
    logger.warn('[emailService] sendOnboardingJoinReminderToTaTeam: no recipient emails');
    return { success: false, error: 'No recipient emails', skipRetry: true };
  }

  const transporter = createTransporter();
  if (!transporter) {
    logger.warn('[emailService] SMTP_HOST is not set; cannot send onboarding reminder email');
    return { success: false, error: 'SMTP not configured', skipRetry: true };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@localhost';
  const subject = `[Talent Acquisition] Join reminder: ${candidateName} — ${offsetDays} day(s) until join date`;

  const textLines = [
    `This is an automated onboarding join-date reminder for the TA Team.`,
    ``,
    `Candidate: ${candidateName}`,
    `Join date: ${joinDateFormatted}`,
    `Department: ${department}`,
    `Reminder window: ${offsetDays} day(s) before join date`,
    ``,
    `Please ensure onboarding tasks are on track.`,
  ];
  const text = textLines.join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111827;">
  <h2 style="margin-bottom: 8px;">Onboarding join-date reminder</h2>
  <p style="color: #6b7280; margin-top: 0;">Automated message for <strong>TA Team</strong> (${offsetDays} day(s) before join date).</p>
  <table style="border-collapse: collapse; margin-top: 16px;">
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600;">Candidate</td><td>${escapeHtml(candidateName)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600;">Join date</td><td>${escapeHtml(joinDateFormatted)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; font-weight: 600;">Department</td><td>${escapeHtml(department)}</td></tr>
  </table>
  <p style="margin-top: 20px; font-size: 14px; color: #374151;">Please confirm onboarding preparation for this candidate.</p>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to: emails,
      subject,
      text,
      html,
    });
    logger.info(
      `[emailService] Onboarding reminder email sent for candidate="${candidateName}" offsetDays=${offsetDays} recipients=${emails.length}`
    );
    return { success: true };
  } catch (err) {
    logger.error('[emailService] Failed to send onboarding reminder email', {
      message: err.message,
      code: err.code,
      command: err.command,
      stack: err.stack,
    });
    return { success: false, error: err.message };
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  createTransporter,
  sendOnboardingJoinReminderToTaTeam,
};
