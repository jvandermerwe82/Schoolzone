/**
 * What a parent and a teacher may see, derived from the same engine state.
 *
 * Rules, enforced here and tested:
 * - a teacher card exists only when the parent has switched on sharing;
 * - neither card carries a name, id, avatar, raw answer, chat or reward;
 * - curriculum status always comes from the canonical evidence model, split
 *   into independent and helped evidence, and never from the model estimate;
 * - a single wrong answer is described as a possible slip, never a diagnosis;
 * - what someone SAID helps is kept apart from what was MEASURED.
 */
import { getMisconception } from '../brain/misconceptions';
import { STRATEGY_LABEL } from '../brain/help';
import type { CanonicalProgressStatus } from '../brain/canonical-progress';
import type { Profile } from '../brain/types';
import { getSkill } from '../content/skills';
import { australianTeacherObjective, type StructuredHomework } from '../curriculum/australia-teacher-objectives';
import { selectCanonicalNode, selectMisconceptions, selectSupport } from './selectors';
import type { CanonicalNodeView } from './views';

const WEEK = 7 * 86_400_000;

export interface ParentCard {
  audience: 'parent';
  headline: string;
  thisWeek: string;
  statusLine: string;
  evidenceNote: string;
  howSchoolZoneHelped: string[];
  watchFor: { title: string; line: string; kind: 'possible-slip' | 'pattern' }[];
  tryAtHome: string[];
  whatSeemsToHelp: string[];
  footer: string;
}

export interface TeacherCard {
  audience: 'teacher';
  visible: boolean;
  /** Set when visible is false. */
  withheldReason: string | null;
  objective: {
    title: string;
    code: string | null;
    statusLabel: string;
    status: CanonicalProgressStatus;
    directEvidence: number;
    independentDirect: number;
    assistedDirect: number;
    supportingEvidence: number;
    weightedSuccess: number | null;
    confidence: number;
    caveat: string | null;
  } | null;
  stuckNow: { skill: string; level: number } | null;
  patterns: { name: string; seen: number }[];
  possibleSlips: { name: string; seen: number }[];
  answeredThisWeek: number | null;
  supportNotes: string[];
  footer: string;
}

const PARENT_STATUS: Record<CanonicalProgressStatus, string> = {
  'not-started': 'Not started yet.',
  developing: 'Getting there. There are some good answers so far.',
  'needs-support': 'This is tricky right now, and SchoolZone is giving extra help.',
  'strong-evidence': 'Strong results so far. A few more answers will make it solid.',
  'requires-broader-evidence': 'Strong quiz results. This topic also needs hands-on work that a quiz cannot show.',
  mastered: 'Strong results in the app. Your teacher is still the best judge of the full picture.',
};

const helpedSentences = (profile: Profile): string[] => {
  const lines: string[] = [];
  const help = profile.help;
  if (help && help.stuck > 0) {
    lines.push(`Your child got stuck ${help.stuck === 1 ? 'once' : `${help.stuck} times`} and SchoolZone stayed with them instead of moving on.`);
  }
  for (const [strategy, record] of Object.entries(help?.strategies ?? {})) {
    if (!record || record.tried === 0) continue;
    const label = STRATEGY_LABEL[strategy as keyof typeof STRATEGY_LABEL];
    lines.push(`${label} helped in ${record.helped} of ${record.tried} ${record.tried === 1 ? 'try' : 'tries'}.`);
  }
  return lines;
};

export function parentCardFor(
  profile: Profile,
  input: { homework: StructuredHomework; now: number; activeNodeId: string },
): ParentCard {
  const node = selectCanonicalNode(profile, input.activeNodeId);
  const misconceptions = selectMisconceptions(profile).filter((m) => m.status !== 'cleared');
  const supports = selectSupport(profile, input.homework.practiceSkillId, input.now).rows;
  const thisWeek = profile.history.filter((h) => h.at > input.now - WEEK).length;

  let evidenceNote: string;
  if (!node || node.directEvidence === 0) evidenceNote = 'No answers on this topic yet.';
  else if (node.reliesOnAssistedEvidence) evidenceNote = 'Most answers so far used help. Help builds skill, but answers without help show what your child can do alone.';
  else if (node.independentDirect >= 4) evidenceNote = 'Most answers were done without help, which is a good sign.';
  else evidenceNote = 'It is still early. SchoolZone needs more answers done without help before it can say more.';

  return {
    audience: 'parent',
    headline: input.homework.objective,
    thisWeek: thisWeek === 0 ? 'No questions this week.' : `${thisWeek} ${thisWeek === 1 ? 'question' : 'questions'} this week.`,
    statusLine: node ? PARENT_STATUS[node.status] : PARENT_STATUS['not-started'],
    evidenceNote,
    howSchoolZoneHelped: helpedSentences(profile),
    watchFor: misconceptions.map((m) => ({
      title: m.name,
      kind: m.status === 'active-pattern' ? 'pattern' : 'possible-slip',
      line: m.status === 'active-pattern'
        ? `This has come up more than once, so practice is aiming at it. ${getMisconception(m.id).noticed}`
        : 'This came up once. One wrong answer can be a slip, so SchoolZone is only watching.',
    })),
    tryAtHome: misconceptions.filter((m) => m.status === 'active-pattern').map((m) => getMisconception(m.id).fix),
    whatSeemsToHelp: supports
      .filter((row) => row.observed.strength === 'repeated')
      .map((row) => `Early signs ${row.observed.score >= 0 ? 'favour' : 'count against'} "${row.label}" for your child. This is observation, not proof.`),
    footer: 'This summary shows app practice only. It never includes your child’s individual answers or messages.',
  };
}

export const WITHHELD_REASON = 'A parent has not switched on sharing progress with the teacher, so nothing is shown.';

export function withheldTeacherCard(): TeacherCard {
  return {
    audience: 'teacher', visible: false, withheldReason: WITHHELD_REASON, objective: null, stuckNow: null,
    patterns: [], possibleSlips: [], answeredThisWeek: null, supportNotes: [],
    footer: 'Teachers only see a pupil when a parent has chosen to share progress.',
  };
}

export function teacherCardFor(
  profile: Profile,
  input: { homework: StructuredHomework; now: number; shared: boolean },
): TeacherCard {
  if (!input.shared) return withheldTeacherCard();
  const definition = australianTeacherObjective(input.homework.objectiveId);
  const node: CanonicalNodeView | null = selectCanonicalNode(profile, input.homework.canonicalNodeId);
  const episode = profile.help?.episode ?? null;
  const misconceptions = selectMisconceptions(profile);
  const supports = selectSupport(profile, input.homework.practiceSkillId, input.now).rows;
  return {
    audience: 'teacher',
    visible: true,
    withheldReason: null,
    objective: node ? {
      title: definition?.title ?? input.homework.objective,
      code: node.curriculumCode,
      statusLabel: node.statusLabel,
      status: node.status,
      directEvidence: node.directEvidence,
      independentDirect: node.independentDirect,
      assistedDirect: node.assistedDirect,
      supportingEvidence: node.supportingEvidence,
      weightedSuccess: node.weightedSuccess,
      confidence: node.confidence,
      caveat: node.caveat,
    } : null,
    stuckNow: episode ? { skill: getSkill(episode.skillId).name, level: episode.stuckLevel } : null,
    patterns: misconceptions.filter((m) => m.status === 'active-pattern').map((m) => ({ name: m.name, seen: m.seen })),
    possibleSlips: misconceptions.filter((m) => m.status === 'possible-slip').map((m) => ({ name: m.name, seen: m.seen })),
    answeredThisWeek: profile.history.filter((h) => h.at > input.now - WEEK).length,
    supportNotes: supports
      .filter((row) => row.stated.learner || row.stated.parent || row.observed.evidenceCount > 0)
      .map((row) => {
        const said = [row.stated.learner && `learner ${row.stated.learner === 'prefer' ? 'prefers' : row.stated.learner === 'avoid' ? 'avoids' : 'neutral on'}`, row.stated.parent && `parent ${row.stated.parent === 'prefer' ? 'prefers' : row.stated.parent === 'avoid' ? 'avoids' : 'neutral on'}`].filter(Boolean).join(', ');
        return `${row.label}: ${said ? `stated: ${said}. ` : ''}Measured: ${row.observed.strengthLabel.toLowerCase()}.`;
      }),
    footer: 'Curriculum status comes from app question evidence only. It does not replace your professional judgement.',
  };
}
