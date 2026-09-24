import type { SubjectId } from '../brain/types';
import type { LearningIntelligenceState, LearningIntent } from '../brain/learning-intelligence';

export type TeacherIntentPriority = 1 | 2 | 3;

export interface TeacherObjectiveDefinition {
  id: string;
  title: string;
  subject: SubjectId;
  yearLevel: '4' | '5' | '6';
  canonicalNodeId: string;
  curriculumRefs: string[];
  /** Current executable SchoolZone route while native Australian banks are built. */
  practiceSkillId: string;
  /** Whether current content directly or only partially teaches this objective. */
  routeStrength: 'direct' | 'supporting';
}

export interface LegacyHomework {
  skillId: string;
  note: string;
  setAt: number;
}

export interface StructuredHomework {
  version: 2;
  id: string;
  objectiveId: string;
  objective: string;
  subject: SubjectId;
  yearLevel: '4' | '5' | '6';
  canonicalNodeId: string;
  curriculumRefs: string[];
  practiceSkillId: string;
  priority: TeacherIntentPriority;
  dueAt: number | null;
  note: string;
  setAt: number;
}

export type TeacherHomework = LegacyHomework | StructuredHomework;

const objective = (
  id: string,
  title: string,
  subject: SubjectId,
  yearLevel: '4' | '5' | '6',
  canonicalNodeId: string,
  curriculumRefs: string[],
  practiceSkillId: string,
  routeStrength: 'direct' | 'supporting',
): TeacherObjectiveDefinition => ({
  id, title, subject, yearLevel, canonicalNodeId, curriculumRefs, practiceSkillId, routeStrength,
});

/**
 * First teacher-assignable Australian objectives.
 *
 * Only objectives with a safe current practice route are listed. Missing
 * Australian content stays unavailable until a native bank/generator exists.
 */
export const AUSTRALIAN_TEACHER_OBJECTIVES: readonly TeacherObjectiveDefinition[] = [
  objective('au4-mul-facts', 'Multiplication and related division facts', 'maths', '4',
    'math.facts.mul-div-10x10', ['au-ac-v9:AC9M4A02'], 'multiplication', 'direct'),
  objective('au4-forces', 'Friction, gravity and magnetism', 'science', '4',
    'science.forces.friction-gravity-magnetism', ['au-ac-v9:AC9S4U03'], 'forces-energy', 'direct'),
  objective('au4-materials', 'Material properties and uses', 'science', '4',
    'science.materials.properties-use', ['au-ac-v9:AC9S4U04'], 'materials', 'supporting'),
  objective('au4-reading', 'Reading: literal and inferred meaning', 'english', '4',
    'english.reading.comprehension-y4', ['au-ac-v9:AC9E4LY05'], 'reading-y6', 'direct'),
  objective('au4-homophones', 'Homophones in context', 'english', '4',
    'english.spelling.homophones-context-y4', ['au-ac-v9:AC9E4LY11'], 'homophones', 'direct'),

  objective('au5-factors', 'Factors, multiples and divisibility', 'maths', '5',
    'math.number.factors-multiples-divisibility', ['au-ac-v9:AC9M5N02'], 'factors-primes', 'supporting'),
  objective('au5-fraction-equivalence', 'Fraction, decimal and percentage equivalence', 'maths', '5',
    'math.percentages.fraction-decimal-equivalence', ['au-ac-v9:AC9M5N04'], 'decimals-percentages', 'direct'),
  objective('au5-large-multiplication', 'Multiply larger whole numbers', 'maths', '5',
    'math.multiplication.large-numbers', ['au-ac-v9:AC9M5N06'], 'long-multiplication-division', 'direct'),
  objective('au5-unknowns', 'Unknowns in multiplication and division equations', 'maths', '5',
    'math.equations.mul-div-unknowns', ['au-ac-v9:AC9M5A02'], 'algebra', 'direct'),
  objective('au5-light', 'Light, shadows, reflection and refraction', 'science', '5',
    'science.light.travel-shadows-reflection-refraction', ['au-ac-v9:AC9S5U03'], 'light-y6', 'direct'),
  objective('au5-particles', 'Solids, liquids, gases and particle model', 'science', '5',
    'science.matter.particle-states', ['au-ac-v9:AC9S5U04'], 'materials', 'supporting'),
  objective('au5-reading', 'Reading: infer, evaluate and connect ideas', 'english', '5',
    'english.reading.comprehension-y5', ['au-ac-v9:AC9E5LY05'], 'reading-y6', 'direct'),
  objective('au5-spelling', 'Build words using bases, affixes and spelling patterns', 'english', '5',
    'english.spelling.word-building-y5', ['au-ac-v9:AC9E5LY09'], 'spelling-patterns', 'supporting'),

  objective('au6-integers', 'Integers and negative numbers', 'maths', '6',
    'math.integers.number-line-cartesian', ['au-ac-v9:AC9M6N01'], 'negative-numbers', 'supporting'),
  objective('au6-primes', 'Prime, composite and square number properties', 'maths', '6',
    'math.number.prime-composite-square', ['au-ac-v9:AC9M6N02'], 'factors-primes', 'supporting'),
  objective('au6-fractions-add-subtract', 'Add and subtract fractions using equivalence', 'maths', '6',
    'math.fractions.add-subtract-equivalent', ['au-ac-v9:AC9M6N05'], 'fractions-y6', 'direct'),
  objective('au6-decimal-powers', 'Multiply and divide decimals by powers of 10', 'maths', '6',
    'math.decimals.mul-div-powers-10', ['au-ac-v9:AC9M6N06'], 'decimals-percentages', 'direct'),
  objective('au6-percent-quantity', 'Find fractions, decimals and percentages of quantities', 'maths', '6',
    'math.quantities.fraction-decimal-percent', ['au-ac-v9:AC9M6N07'], 'decimals-percentages', 'direct'),
  objective('au6-combined-operations', 'Unknowns with brackets and combined operations', 'maths', '6',
    'math.equations.combined-operations', ['au-ac-v9:AC9M6A02'], 'algebra', 'direct'),
  objective('au6-angle-relationships', 'Angle relationships and unknown angles', 'maths', '6',
    'math.angles.relationships', ['au-ac-v9:AC9M6M04'], 'geometry-statistics', 'direct'),
  objective('au6-space', 'Earth, planets, the sun and observable cycles', 'science', '6',
    'science.space.earth-sun-cycles', ['au-ac-v9:AC9S6U02'], 'earth-space', 'supporting'),
  objective('au6-electricity', 'Electrical energy and circuits', 'science', '6',
    'science.electricity.energy-circuits', ['au-ac-v9:AC9S6U03'], 'electricity-y6', 'direct'),
  objective('au6-reading', 'Reading across sources: infer and evaluate', 'english', '6',
    'english.reading.comprehension-y6', ['au-ac-v9:AC9E6LY05'], 'reading-y6', 'direct'),
  objective('au6-spelling', 'Roots, affixes and technical spelling', 'english', '6',
    'english.spelling.roots-technical-y6', ['au-ac-v9:AC9E6LY09'], 'spelling-patterns', 'supporting'),
] as const;

const byId = new Map(AUSTRALIAN_TEACHER_OBJECTIVES.map((item) => [item.id, item]));

export function australianTeacherObjective(id: string): TeacherObjectiveDefinition | null {
  return byId.get(id) ?? null;
}

export function structuredHomework(
  definition: TeacherObjectiveDefinition,
  now: number,
  input: { note?: string; priority?: TeacherIntentPriority; dueAt?: number | null },
): StructuredHomework {
  return {
    version: 2,
    id: `teacher:${definition.id}:${now}`,
    objectiveId: definition.id,
    objective: definition.title,
    subject: definition.subject,
    yearLevel: definition.yearLevel,
    canonicalNodeId: definition.canonicalNodeId,
    curriculumRefs: [...definition.curriculumRefs],
    practiceSkillId: definition.practiceSkillId,
    priority: input.priority ?? 2,
    dueAt: input.dueAt ?? null,
    note: (input.note ?? '').trim().slice(0, 140),
    setAt: now,
  };
}

export function isStructuredHomework(homework: TeacherHomework): homework is StructuredHomework {
  return (homework as StructuredHomework).version === 2;
}

/**
 * Sync the school's current teacher objective into the learner's persistent
 * Current Direction. Replaces/cancels older teacher intents without touching
 * parent, learner or SchoolZone intents.
 */
export function syncTeacherHomeworkIntent(
  state: LearningIntelligenceState,
  homework: TeacherHomework | null,
  learnerYear?: number,
): LearningIntelligenceState {
  const teacherIntents = state.intents.filter((intent) => intent.source === 'teacher');
  const other = state.intents.filter((intent) => intent.source !== 'teacher');
  const yearLevel = learnerYear && learnerYear >= 4 && learnerYear <= 6 ? String(learnerYear) : null;
  const curriculumState = homework && isStructuredHomework(homework) && yearLevel
    ? {
        ...state,
        curriculum: {
          jurisdiction: 'AU',
          curriculumId: 'au-ac-v9',
          curriculumVersion: '9.0',
          yearLevel,
        },
      }
    : state;

  if (!homework || !isStructuredHomework(homework)) {
    const cancelled = teacherIntents.map((intent) => intent.status === 'active' ? { ...intent, status: 'cancelled' as const } : intent);
    if (cancelled.every((intent, index) => intent === teacherIntents[index])) return curriculumState;
    return { ...curriculumState, intents: [...other, ...cancelled] };
  }

  const next: LearningIntent = {
    id: homework.id,
    source: 'teacher',
    objective: homework.objective,
    skillIds: [homework.practiceSkillId],
    canonicalNodeIds: [homework.canonicalNodeId],
    curriculumRefs: [...homework.curriculumRefs],
    priority: homework.priority,
    assignedAt: homework.setAt,
    dueAt: homework.dueAt,
    status: 'active',
  };

  const existing = teacherIntents.find((intent) => intent.id === next.id);
  const same = existing && JSON.stringify(existing) === JSON.stringify(next)
    && teacherIntents.every((intent) => intent.id === next.id || intent.status !== 'active');
  if (same && curriculumState === state) return state;
  if (same) return curriculumState;

  const previous = teacherIntents
    .filter((intent) => intent.id !== next.id)
    .map((intent) => intent.status === 'active' ? { ...intent, status: 'cancelled' as const } : intent);

  return { ...curriculumState, intents: [...other, ...previous, next] };
}
