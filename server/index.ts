/**
 * Starts the Schoolzone server. Settings come from environment variables
 * (see .env.example). In production it also serves the built app from dist/.
 */
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { backupDb } from './backup';
import { openDb, pruneOldData } from './db';
import { ConsoleMailer, SmtpMailer } from './mailer';
import { ClaudeTutorModel } from './tutor';

const env = process.env;
const production = env.NODE_ENV === 'production';
const port = Number(env.PORT ?? 8787);
const retentionDays = Number(env.RETENTION_DAYS ?? 365);

const db = openDb(env.DATABASE_PATH ?? 'schoolzone.db');

// The tutor is only switched on when Anthropic credentials are configured.
const tutorEnabled = env.TUTOR_ENABLED !== 'false' && !!(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN);
const effort = (env.TUTOR_EFFORT ?? 'medium') as 'low' | 'medium' | 'high';
const tutor = tutorEnabled ? new ClaudeTutorModel(env.TUTOR_MODEL ?? 'claude-opus-5', effort) : null;

const mailer = env.SMTP_URL ? new SmtpMailer(env.SMTP_URL, env.MAIL_FROM ?? 'Schoolzone <no-reply@localhost>') : new ConsoleMailer();
if (production && !env.SMTP_URL) console.warn('SMTP_URL is not set: emails (verification, password reset, safety alerts) will only be logged.');
if (production && !env.APP_URL) console.warn('APP_URL is not set: links in emails will point to localhost.');

if (production && !env.EXPORT_SALT && env.ADMIN_TOKEN) {
  console.warn('EXPORT_SALT is not set: research exports will use ADMIN_TOKEN to pseudonymise ids.');
}

const app = buildApp({
  db,
  tutor,
  secureCookies: production,
  adminToken: env.ADMIN_TOKEN,
  adminEmail: env.ADMIN_EMAIL,
  exportSalt: env.EXPORT_SALT,
  tutorDailyLimit: Number(env.TUTOR_DAILY_LIMIT ?? 60),
  mailer,
  appUrl: env.APP_URL ?? `http://localhost:${production ? port : 5173}`,
  // TRUST_PROXY=true (or the proxy's addresses) when running behind a hosting proxy / load balancer.
  trustProxy: !env.TRUST_PROXY || env.TRUST_PROXY === 'false' ? false : env.TRUST_PROXY === 'true' ? true : env.TRUST_PROXY,
  hsts: production && (env.APP_URL ?? '').startsWith('https://'),
  logger: true,
});

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
if (production && existsSync(dist)) {
  app.register(fastifyStatic, { root: dist });
  // Single-page app: unknown non-API routes get index.html.
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith('/api/') ? reply.code(404).send({ error: 'Not found.' }) : reply.sendFile('index.html'));
}

const daily = () => {
  pruneOldData(db, Date.now(), retentionDays);
  if (env.BACKUP_DIR) {
    try {
      const file = backupDb(db, env.BACKUP_DIR, new Date(), Number(env.BACKUP_KEEP ?? 14));
      app.log.info(`Backup written to ${file}`);
    } catch (err) {
      app.log.error({ err }, 'Backup failed');
    }
  }
};
daily();
setInterval(daily, 86_400_000).unref();
if (production && !env.BACKUP_DIR) console.warn('BACKUP_DIR is not set: no automatic backups.');

// Finish in-flight requests and close the database cleanly when the host stops the app.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void app.close().then(() => { db.close(); process.exit(0); });
  });
}

app.listen({ port, host: env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1') }).then(() => {
  console.log(`Schoolzone server on port ${port}. AI tutor: ${tutor ? `on (${env.TUTOR_MODEL ?? 'claude-opus-5'})` : 'off'}.`);
});
