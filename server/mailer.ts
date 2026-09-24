/**
 * Sending email. Works with any provider that offers SMTP (set SMTP_URL).
 * Without SMTP_URL, emails are written to the server log instead, which is
 * fine for development but not for real families.
 */
import nodemailer from 'nodemailer';

export interface Email { to: string; subject: string; text: string }

export interface Mailer {
  send(email: Email): Promise<void>;
}

export class SmtpMailer implements Mailer {
  private transport;
  constructor(smtpUrl: string, private from: string) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }
  async send(email: Email): Promise<void> {
    await this.transport.sendMail({ from: this.from, to: email.to, subject: email.subject, text: email.text });
  }
}

export class ConsoleMailer implements Mailer {
  async send(email: Email): Promise<void> {
    console.log(`\n--- Email (not sent: SMTP_URL is not set) ---\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n---\n`);
  }
}

/** Keeps emails in memory, for tests. */
export class MemoryMailer implements Mailer {
  sent: Email[] = [];
  async send(email: Email): Promise<void> {
    this.sent.push(email);
  }
  /** The last link sent to an address, e.g. a reset or verification link. */
  lastLink(to: string): string | null {
    const mail = [...this.sent].reverse().find((m) => m.to === to);
    return mail?.text.match(/https?:\/\/\S+/)?.[0] ?? null;
  }
}

const SIGN_OFF = '\n\nThe Schoolzone team';

export const emails = {
  verify: (link: string): Omit<Email, 'to'> => ({
    subject: 'Please confirm your email for Schoolzone',
    text: `Hello,\n\nPlease confirm this is your email address by opening this link:\n\n${link}\n\nWe need this so we can reach you about your child's account, for example if something in the AI tutor needs your attention.\n\nIf you didn't create a Schoolzone account, you can ignore this email.${SIGN_OFF}`,
  }),
  reset: (link: string): Omit<Email, 'to'> => ({
    subject: 'Reset your Schoolzone password',
    text: `Hello,\n\nSomeone (hopefully you) asked to reset your Schoolzone password. Open this link to choose a new one. It works once and expires in 1 hour:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email. Your password won't change.${SIGN_OFF}`,
  }),
  passwordChanged: (): Omit<Email, 'to'> => ({
    subject: 'Your Schoolzone password was changed',
    text: `Hello,\n\nYour Schoolzone password was just changed, and all devices were signed out.\n\nIf this wasn't you, reset your password straight away using "Forgot password?" on the sign-in page.${SIGN_OFF}`,
  }),
  safetyFlag: (childName: string, category: string, appUrl: string): Omit<Email, 'to'> => ({
    subject: `Schoolzone: please check ${childName}'s AI tutor chat`,
    text: `Hello,\n\nA message ${childName} typed to the Schoolzone AI tutor was flagged for you to check (category: ${category}).\n\nThe message was not sent to the AI. ${childName} was shown a kind message suggesting they talk to a trusted adult, and Childline (free on 0800 1111).\n\nTo read the chat, sign in at ${appUrl}, open Parents, then "Read ${childName}'s AI tutor chats".\n\nIf you think ${childName} may be at risk, please talk with them, and contact your local services or the NSPCC helpline for advice.${SIGN_OFF}`,
  }),
  schoolPending: (schoolName: string, ownerEmail: string): Omit<Email, 'to'> => ({
    subject: `Schoolzone: new school to approve (${schoolName})`,
    text: `Hello,\n\n${ownerEmail} registered the school "${schoolName}" for the leaderboard.\n\nBefore approving, check that this person really works at the school (for example, a reply from the school's office or an address on the school's own email domain).\n\nList schools waiting for approval:\n  curl -H "x-admin-token: $ADMIN_TOKEN" <APP_URL>/api/admin/schools${SIGN_OFF}`,
  }),
  schoolApproved: (schoolName: string, appUrl: string): Omit<Email, 'to'> => ({
    subject: `Schoolzone: ${schoolName} is ready`,
    text: `Hello,\n\n${schoolName} has been approved for the Schoolzone leaderboard. Sign in at ${appUrl} and open "Teachers" to see your school's join code. Give it to parents: they enter it in the Parents area to join.${SIGN_OFF}`,
  }),
};
