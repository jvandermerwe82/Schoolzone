import type { SupportOutcome, SupportStrategyId } from './learning-intelligence';

export const SUPPORT_RECENCY_HALF_LIFE_DAYS = 21;
export const SUPPORT_EXACT_SKILL_WEIGHT = 1;
export const SUPPORT_SAME_SUBJECT_WEIGHT = 0.65;
export const SUPPORT_GLOBAL_WEIGHT = 0.35;
export const SUPPORT_OTHER_SUBJECT_WEIGHT = 0.12;

export const RAPID_EXACT_MIN_COUNT = 2;
export const RAPID_EXACT_MIN_SCORE = 0.6;
export const RAPID_EXACT_MIN_CONFIDENCE = 0.25;

const DAY = 86_400_000;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface SupportLearningContext {
  now?: number;
  subject?: string;
  skillId?: string;
}

export interface ContextualSupportSummary {
  strategy: SupportStrategyId;
  score: number;
  confidence: number;
  evidenceCount: number;
  exactSkillCount: number;
  sameSubjectCount: number;
  effectiveWeight: number;
  lastObservedAt: number | null;
  rapidEligible: boolean;
}

const contextWeight = (outcome: SupportOutcome, context: SupportLearningContext): number => {
  if (context.skillId && outcome.skillId === context.skillId) return SUPPORT_EXACT_SKILL_WEIGHT;
  if (context.subject && outcome.subject === context.subject) return SUPPORT_SAME_SUBJECT_WEIGHT;
  if (!outcome.subject && !outcome.skillId) return SUPPORT_GLOBAL_WEIGHT;
  if (context.subject && outcome.subject && outcome.subject !== context.subject) return SUPPORT_OTHER_SUBJECT_WEIGHT;
  return SUPPORT_GLOBAL_WEIGHT;
};

const recencyWeight = (at: number, now?: number): number => {
  if (now === undefined || !Number.isFinite(now) || now <= at) return 1;
  const ageDays = (now - at) / DAY;
  return Math.pow(0.5, ageDays / SUPPORT_RECENCY_HALF_LIFE_DAYS);
};

/**
 * Fast but stable support learning:
 * - exact-skill evidence transfers most strongly;
 * - same-subject evidence transfers moderately;
 * - unrelated-subject evidence transfers only weakly;
 * - recent evidence matters more so the Brain can change its mind;
 * - confidence still depends on repeated weighted evidence.
 */
export function contextualSupportSummary(
  outcomes: readonly SupportOutcome[],
  strategy: SupportStrategyId,
  context: SupportLearningContext = {},
): ContextualSupportSummary {
  const relevant = outcomes.filter((outcome) => outcome.strategy === strategy);

  let effectiveWeight = 0;
  let weightedScore = 0;
  let exactSkillCount = 0;
  let sameSubjectCount = 0;
  let lastObservedAt: number | null = null;

  for (const outcome of relevant) {
    const baseWeight = clamp(Number.isFinite(outcome.weight) ? outcome.weight : 0, 0, 1);
    const delta = clamp(Number.isFinite(outcome.delta) ? outcome.delta : 0, -1, 1);
    const contextMultiplier = contextWeight(outcome, context);
    const recent = recencyWeight(outcome.at, context.now);
    const weight = baseWeight * contextMultiplier * recent;

    if (context.skillId && outcome.skillId === context.skillId) exactSkillCount++;
    if (context.subject && outcome.subject === context.subject) sameSubjectCount++;

    effectiveWeight += weight;
    weightedScore += delta * weight;
    lastObservedAt = lastObservedAt === null ? outcome.at : Math.max(lastObservedAt, outcome.at);
  }

  const score = effectiveWeight > 0 ? weightedScore / effectiveWeight : 0;
  // Faster than the global long-term summary, but still asymptotic and bounded.
  const confidence = effectiveWeight > 0 ? 1 - Math.exp(-effectiveWeight / 2.5) : 0;
  const rapidEligible = exactSkillCount >= RAPID_EXACT_MIN_COUNT
    && confidence >= RAPID_EXACT_MIN_CONFIDENCE
    && Math.abs(score) >= RAPID_EXACT_MIN_SCORE;

  return {
    strategy,
    score,
    confidence,
    evidenceCount: relevant.length,
    exactSkillCount,
    sameSubjectCount,
    effectiveWeight,
    lastObservedAt,
    rapidEligible,
  };
}
