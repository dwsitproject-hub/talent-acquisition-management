/**
 * One-off SMTP delivery probe (not for production cron).
 * Usage: node scripts/testSmtpDelivery.js [toEmail]
 */
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const to = process.argv[2] || 'stevanus.kurniawan@energi-up.com';
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
const host = process.env.SMTP_HOST;

async function trySend(label, opts) {
  // eslint-disable-next-line no-console
  console.log(`\n=== TRY ${label} ===`);
  const transporter = nodemailer.createTransport(opts);
  try {
    await transporter.verify();
    // eslint-disable-next-line no-console
    console.log('verify ok');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('verify fail:', e.message);
    return false;
  }
  try {
    const info = await transporter.sendMail({
      from: `"TAS Onboarding Reminder" <${user}>`,
      to,
      subject: `[Talent Acquisition] Delivery retry via ${label} ${new Date().toISOString()}`,
      text:
        `Retry via ${label} at ${new Date().toISOString()}\n` +
        'If you see this, SMTP accepted and mailbox delivery worked.',
    });
    // eslint-disable-next-line no-console
    console.log({
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      messageId: info.messageId,
    });
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('send fail:', e.message, e.responseCode, e.response);
    return false;
  }
}

(async () => {
  // eslint-disable-next-line no-console
  console.log({ host, user, passSet: !!pass, to });

  const ok587 = await trySend('587', {
    host,
    port: 587,
    secure: false,
    auth: { user, pass },
  });

  const ok465 = await trySend('465-ssl', {
    host,
    port: 465,
    secure: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false' },
  });

  process.exit(ok587 || ok465 ? 0 : 1);
})();
