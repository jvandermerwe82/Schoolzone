/**
 * Starts the Schoolzone server. Settings come from environment variables
 * (see .env.example). In production it also serves the built app from dist/.
 */
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { openDb, pruneOldData } from './db';
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

if (production && !env.EXPORT_SALT && env.ADMIN_TOKEN) {
  console.warn('EXPORT_SALT is not set: research exports will use ADMIN_TOKEN to pseudonymise ids.');
}

const app = buildApp({
  db,
  tutor,
  secureCookies: production,
  adminToken: env.ADMIN_TOKEN,
  exportSalt: env.EXPORT_SALT,
  tutorDailyLimit: Number(env.TUTOR_DAILY_LIMIT ?? 60),
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

pruneOldData(db, Date.now(), retentionDays);
setInterval(() => pruneOldData(db, Date.now(), retentionDays), 86_400_000).unref();

app.listen({ port, host: env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1') }).then(() => {
  console.log(`Schoolzone server on port ${port}. AI tutor: ${tutor ? `on (${env.TUTOR_MODEL ?? 'claude-opus-5'})` : 'off'}.`);
});
