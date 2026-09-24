/**
 * Local preview only: serves the built app with a stand-in tutor that gives
 * scripted replies, so the tutor screens can be tried without an API key.
 * The real safety checks still run on every reply. Not used in production.
 */
import fastifyStatic from '@fastify/static';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { openDb } from './db';
import type { TutorModel } from './tutor';

const scripted: TutorModel = {
  async reply(_system, messages) {
    const last = messages.at(-1)!.content.toLowerCase();
    // Deliberately "leak" the real answer when asked for it: the app's answer check must block this.
    const answer = messages[0].content.match(/Correct answer: (.+)/)?.[1] ?? '';
    if (last.includes('answer')) return { text: `The answer is ${answer}.`, refused: false };
    return { text: 'Good thinking! What do the ones add up to, and what do you do when that is 10 or more?', refused: false };
  },
};

const port = Number(process.env.PORT ?? 8788);
const app = buildApp({ db: openDb(process.env.DATABASE_PATH ?? ':memory:'), tutor: scripted, logger: false, appUrl: process.env.APP_URL ?? `http://127.0.0.1:${port}` });
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
app.register(fastifyStatic, { root: dist });
app.setNotFoundHandler((req, reply) => (req.url.startsWith('/api/') ? reply.code(404).send({}) : reply.sendFile('index.html')));
app.listen({ port, host: '127.0.0.1' }).then(() => console.log('preview with scripted tutor ready'));
