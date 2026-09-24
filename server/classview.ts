/**
 * The teacher's class view and homework.
 *
 * A teacher only sees a pupil if that pupil's parent switched on "share
 * progress with the teacher". Then the teacher sees the name the parent gave,
 * which skills are mastered or causing trouble, mistake patterns, and whether
 * the pupil is stuck right now. Never answers, chats or rewards.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { skillReport, type SkillStatus } from '../src/brain/insights';
import { misconceptionReport } from '../src/brain/misconceptions';
import type { Profile } from '../src/brain/types';
import { getSkill, SKILLS } from '../src/content/skills';
import { australianTeacherObjective, structuredHomework } from '../src/curriculum/australia-teacher-objectives';
import { normalizeProfile } from '../src/storage';
import type { DB } from './db';
import { screen } from './safety';
import { scrub } from './tutor';

interface Ctx {
  db: DB;
  now: () => number;
  requireParent: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
}

const Y6 = SKILLS.filter((s) => s.typicalYear === 6);
const WEEK = 7 * 86_400_000;
const MAX_NOTE = 140;

export interface ClassPupil {
  name: string;
  avatar: string;
  lastActive: number | null;
  answeredThisWeek: number;
  stuck: { skill: string; level: number; since: number } | null;
  mistakes: string[];
  skills: Record<string, SkillStatus>;
}

/** Everything the teacher sees about one sharing pupil. */
export function pupilSummary(profile: Profile, now: number): ClassPupil {
  const last = profile.history.at(-1)?.at ?? null;
  const ep = profile.help.episode;
  return {
    name: profile.name,
    avatar: profile.avatar,
    lastActive: last,
    answeredThisWeek: profile.history.filter((h) => h.at > now - WEEK).length,
    stuck: ep ? { skill: getSkill(ep.skillId).name, level: ep.stuckLevel, since: ep.startedAt } : null,
    mistakes: misconceptionReport(profile).active.map((r) => r.misconception.name),
    skills: Object.fromEntries(Y6.map((s) => [s.id, skillReport(profile, s).status])),
  };
}

/** Class totals: which Year 6 skills need work, and the most common mistake patterns. */
export function classSummary(pupils: ClassPupil[]) {
  const skills = Y6.map((s) => {
    const count = (st: SkillStatus[]) => pupils.filter((p) => st.includes(p.skills[s.id])).length;
    return {
      skillId: s.id, name: s.name, subject: s.subject,
      mastered: count(['mastered']), learning: count(['learning']), struggling: count(['struggling']), notStarted: count(['ready', 'locked']),
    };
  });
  const mistakes = new Map<string, number>();
  for (const p of pupils) for (const m of p.mistakes) mistakes.set(m, (mistakes.get(m) ?? 0) + 1);
  return {
    skills,
    mistakes: [...mistakes].map(([name, n]) => ({ name, pupils: n })).sort((a, b) => b.pupils - a.pupils).slice(0, 8),
  };
}

export function registerClassRoutes(app: FastifyInstance, ctx: Ctx): void {
  const { db, now } = ctx;
  /** The teacher's own approved school, or null. */
  const ownSchool = (id: string, parentId: string) => db.prepare("SELECT id, name, focus_json AS focusJson FROM schools WHERE id = ? AND owner_id = ? AND status = 'approved'")
    .get(id, parentId) as { id: string; name: string; focusJson: string | null } | undefined;

  app.get<{ Params: { id: string } }>('/api/schools/:id/class', { preHandler: ctx.requireParent }, async (req, reply) => {
    const school = ownSchool(req.params.id, req.parent!.id);
    if (!school) return reply.code(404).send({ error: 'Not found.' });
    const rows = db.prepare(`SELECT c.profile_json AS json, m.share_progress AS share FROM memberships m JOIN children c ON c.id = m.child_id
      WHERE m.school_id = ?`).all(school.id) as { json: string; share: number }[];
    const t = now();
    const pupils = rows.filter((r) => r.share).map((r) => pupilSummary(normalizeProfile(JSON.parse(r.json)), t))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      school: { name: school.name },
      homework: school.focusJson ? JSON.parse(school.focusJson) : null,
      joined: rows.length,
      notSharing: rows.length - pupils.length,
      pupils,
      summary: classSummary(pupils),
    };
  });

  app.put<{
    Params: { id: string };
    Body: { skillId?: string; objectiveId?: string; note?: string; priority?: 1 | 2 | 3; dueAt?: number | null };
  }>('/api/schools/:id/homework', {
    preHandler: ctx.requireParent,
    schema: {
      body: {
        type: 'object', additionalProperties: false,
        properties: {
          skillId: { type: 'string', maxLength: 64 },
          objectiveId: { type: 'string', maxLength: 80 },
          note: { type: 'string', maxLength: MAX_NOTE },
          priority: { enum: [1, 2, 3] },
          dueAt: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        },
      },
    },
  }, async (req, reply) => {
    const school = ownSchool(req.params.id, req.parent!.id);
    if (!school) return reply.code(404).send({ error: 'Not found.' });

    const note = (req.body.note ?? '').trim().replace(/\s+/g, ' ');
    // Children read this note: no contact details, links or worrying content.
    if (scrub(note) !== note || screen(note)) {
      return reply.code(400).send({ error: 'Please keep the note to the topic: no links, contact details or personal messages.' });
    }

    if (req.body.objectiveId) {
      const definition = australianTeacherObjective(req.body.objectiveId);
      if (!definition) return reply.code(400).send({ error: 'Unknown curriculum objective.' });
      const dueAt = req.body.dueAt ?? null;
      if (dueAt !== null && (!Number.isFinite(dueAt) || dueAt < now() - 60_000 || dueAt > now() + 366 * 86_400_000)) {
        return reply.code(400).send({ error: 'Please choose a valid due date.' });
      }
      const homework = structuredHomework(definition, now(), {
        note,
        priority: req.body.priority ?? 2,
        dueAt,
      });
      db.prepare('UPDATE schools SET focus_json = ? WHERE id = ?').run(JSON.stringify(homework), school.id);
      return { homework };
    }

    // Legacy path kept for existing deployments and old clients.
    if (!req.body.skillId || !SKILLS.some((skill) => skill.id === req.body.skillId)) {
      return reply.code(400).send({ error: 'Unknown topic.' });
    }
    const homework = { skillId: req.body.skillId, note, setAt: now() };
    db.prepare('UPDATE schools SET focus_json = ? WHERE id = ?').run(JSON.stringify(homework), school.id);
    return { homework };
  });

  app.delete<{ Params: { id: string } }>('/api/schools/:id/homework', { preHandler: ctx.requireParent }, async (req, reply) => {
    const school = ownSchool(req.params.id, req.parent!.id);
    if (!school) return reply.code(404).send({ error: 'Not found.' });
    db.prepare('UPDATE schools SET focus_json = NULL WHERE id = ?').run(school.id);
    return { ok: true };
  });
}
