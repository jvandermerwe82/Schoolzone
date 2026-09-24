/**
 * `npm run check:email -- you@example.com`: sends one test email using the
 * SMTP settings in .env, to confirm verification, reset and safety emails
 * will be delivered.
 */
import { SmtpMailer } from '../server/mailer';

const to = process.argv[2];
if (!to) {
  console.error('Usage: npm run check:email -- you@example.com');
  process.exit(1);
}
if (!process.env.SMTP_URL) {
  console.error('SMTP_URL is not set in .env, so emails would only be printed to the log. See .env.example.');
  process.exit(1);
}
const mailer = new SmtpMailer(process.env.SMTP_URL, process.env.MAIL_FROM ?? 'Schoolzone <no-reply@localhost>');
mailer.send({ to, subject: 'Schoolzone test email', text: 'This is a test from your Schoolzone server. If you can read it, email is working.' })
  .then(() => console.log(`Sent. Check ${to} (and the spam folder).`))
  .catch((err: Error) => { console.error(`Sending failed: ${err.message}`); process.exit(1); });
