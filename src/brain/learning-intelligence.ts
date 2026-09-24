/**
 * SchoolZone Learning Intelligence v1.
 *
 * These contracts extend the existing academic learner model. They deliberately
 * describe what helps a learner without inferring medical or diagnostic labels.
 */

export const LEARNING_INTELLIGENCE_VERSION = 1 as const;

export interface CurriculumContext {
  /** ISO-style country/jurisdiction identifier, e.g. "AU", "AU-QLD", "GB-ENG". */
  jurisdiction: string;
  /** Stable SchoolZone curriculum-pack id, e.g. "au-ac-v9". */
  curriculumId: string;
  /** Version supplied by the curriculum pack, not by the Brain. */
  curriculumVersion: string;
  /** Local year/grade label, e.g. "5" or "Year 5". */
  yearLevel: string;
}

export type SupportStrategyId =
  | 'chunked-instructions'
  | 'visible-steps'
  | 'read-aloud'
  | 'reduced-visual-density'
  | 'larger-text'
  | 'extended-response-time'
  | 'shorter-missions'
  | 'predictable-structure'
  | 'worked-examples'
  | 'smaller-steps'
  | 'visual-example'
  | 'reduced-animation'
  | 'optional-breaks';

export type PreferenceSource = 'learner' | 'parent' | 'teacher';
export type PreferenceValue = 'prefer' | 'avoid' | 'neutral';

/**
 * An explicit preference is an instruction/hypothesis about what to try.
 * It is not evidence that the support improves learning.
 */
export interface SupportPreference {
  strategy: SupportStrategyId;
  source: PreferenceSource;
  value: PreferenceValue;
  at: number;
  /** Optional short human-entered context; never a diagnosis field. */
  note?: string;
}

export type SupportOutcomeSource =
  | 'observed-learning'
  | 'learner-feedback'
  | 'parent-feedback'
  | 'teacher-feedback';

/**
 * Outcome while a support strategy was active.
 *
 * delta is normalised to [-1, 1]:
 *  +1 = materially better outcome
 *   0 = no measurable difference
 *  -1 = materially worse outcome
 *
 * weight is [0, 1] and represents evidence quality/reliability for this event.
 */
export interface SupportOutcome {
  strategy: SupportStrategyId;
  at: number;
  delta: number;
  weight: number;
  source: SupportOutcomeSource;
  subject?: string;
  skillId?: string;
}

export interface SupportStrategySummary {
  strategy: SupportStrategyId;
  /** Weighted mean in [-1, 1]. Positive means evidence currently favours the support. */
  score: number;
  /** 0-1 confidence, increasing with repeated weighted evidence. */
  confidence: number;
  evidenceCount: number;
  totalWeight: number;
  lastObservedAt: number | null;
}

export type EngagementSignalKind =
  | 'rapid-guess'
  | 'persisted-after-error'
  | 'requested-help'
  | 'continued-voluntarily'
  | 'stopped-session'
  | 'resumed-after-break';

export interface EngagementSignal {
  kind: EngagementSignalKind;
  at: number;
  subject?: string;
  skillId?: string;
  /** Optional bounded numeric value for a signal such as session minutes. */
  value?: number;
}

export type IntentSource = 'teacher' | 'parent' | 'learner' | 'schoolzone';
export type IntentStatus = 'active' | 'completed' | 'cancelled';

export interface LearningIntent {
  id: string;
  source: IntentSource;
  objective: string;
  skillIds: string[];
  /** Curriculum-pack references, if the objective came from mapped curriculum content. */
  curriculumRefs: string[];
  priority: 1 | 2 | 3;
  assignedAt: number;
  dueAt: number | null;
  status: IntentStatus;
}

export interface LearningIntelligenceState {
  schemaVersion: typeof LEARNING_INTELLIGENCE_VERSION;
  curriculum: CurriculumContext | null;
  supportPreferences: SupportPreference[];
  supportOutcomes: SupportOutcome[];
  engagement: EngagementSignal[];
  intents: LearningIntent[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function emptyLearningIntelligence(curriculum: CurriculumContext | null = null): LearningIntelligenceState {
  return {
    schemaVersion: LEARNING_INTELLIGENCE_VERSION,
    curriculum,
    supportPreferences: [],
    supportOutcomes: [],
    engagement: [],
    intents: [],
  };
}

/**
 * Deterministically aggregate measured outcomes for one support strategy.
 *
 * Preferences are intentionally not accepted here: "we prefer this" and
 * "this improved learning" must remain different claims.
 */
export function summariseSupportStrategy(
  outcomes: readonly SupportOutcome[],
  strategy: SupportStrategyId,
): SupportStrategySummary {
  const relevant = outcomes
    .filter((outcome) => outcome.strategy === strategy)
    .map((outcome) => ({
      ...outcome,
      delta: clamp(Number.isFinite(outcome.delta) ? outcome.delta : 0, -1, 1),
      weight: clamp(Number.isFinite(outcome.weight) ? outcome.weight : 0, 0, 1),
    }));

  const totalWeight = relevant.reduce((sum, outcome) => sum + outcome.weight, 0);
  const weighted = relevant.reduce((sum, outcome) => sum + outcome.delta * outcome.weight, 0);
  const score = totalWeight > 0 ? weighted / totalWeight : 0;

  // Confidence rises gradually with repeated evidence and never reaches 1.
  // The constant is intentionally conservative and can be calibrated later.
  const confidence = totalWeight > 0 ? 1 - Math.exp(-totalWeight / 4) : 0;

  return {
    strategy,
    score,
    confidence,
    evidenceCount: relevant.length,
    totalWeight,
    lastObservedAt: relevant.length > 0 ? Math.max(...relevant.map((outcome) => outcome.at)) : null,
  };
}

/** Current active intent, highest priority first and then earliest due date. */
export function activeLearningIntents(intents: readonly LearningIntent[]): LearningIntent[] {
  const due = (intent: LearningIntent) => intent.dueAt ?? Number.POSITIVE_INFINITY;
  return intents
    .filter((intent) => intent.status === 'active')
    .sort((a, b) => a.priority - b.priority || due(a) - due(b) || a.assignedAt - b.assignedAt);
}


export const MAX_SUPPORT_PREFERENCES = 100;
export const MAX_SUPPORT_OUTCOMES = 500;
export const MAX_ENGAGEMENT_SIGNALS = 500;
export const MAX_LEARNING_INTENTS = 100;

const tail = <T>(items: readonly T[], max: number): T[] => items.slice(Math.max(0, items.length - max));

/** Set or replace one source's current preference for a support strategy. */
export function setSupportPreference(
  state: LearningIntelligenceState,
  preference: SupportPreference,
): LearningIntelligenceState {
  const note = preference.note?.trim().slice(0, 200);
  const next: SupportPreference = { ...preference, ...(note ? { note } : { note: undefined }) };
  const kept = state.supportPreferences.filter(
    (item) => !(item.strategy === next.strategy && item.source === next.source),
  );
  return {
    ...state,
    supportPreferences: tail([...kept, next], MAX_SUPPORT_PREFERENCES),
  };
}

/** Record measured or human-reported evidence about one support strategy. */
export function recordSupportOutcome(
  state: LearningIntelligenceState,
  outcome: SupportOutcome,
): LearningIntelligenceState {
  const next: SupportOutcome = {
    ...outcome,
    delta: clamp(Number.isFinite(outcome.delta) ? outcome.delta : 0, -1, 1),
    weight: clamp(Number.isFinite(outcome.weight) ? outcome.weight : 0, 0, 1),
  };
  return {
    ...state,
    supportOutcomes: tail([...state.supportOutcomes, next], MAX_SUPPORT_OUTCOMES),
  };
}

/** Record a behavioural observation without interpreting it as a diagnosis. */
export function recordEngagementSignal(
  state: LearningIntelligenceState,
  signal: EngagementSignal,
): LearningIntelligenceState {
  const value = signal.value;
  const next: EngagementSignal = {
    ...signal,
    ...(value === undefined
      ? {}
      : { value: clamp(Number.isFinite(value) ? value : 0, -10_000, 10_000) }),
  };
  return {
    ...state,
    engagement: tail([...state.engagement, next], MAX_ENGAGEMENT_SIGNALS),
  };
}

/** Add or replace a learning intent by stable id. */
export function upsertLearningIntent(
  state: LearningIntelligenceState,
  intent: LearningIntent,
): LearningIntelligenceState {
  const objective = intent.objective.trim().slice(0, 240);
  const next: LearningIntent = {
    ...intent,
    objective,
    skillIds: [...new Set(intent.skillIds)].slice(0, 50),
    curriculumRefs: [...new Set(intent.curriculumRefs)].slice(0, 50),
  };
  const kept = state.intents.filter((item) => item.id !== next.id);
  return {
    ...state,
    intents: tail([...kept, next], MAX_LEARNING_INTENTS),
  };
}

/** Explicitly attach a curriculum context. Never inferred from learner behaviour. */
export function setCurriculumContext(
  state: LearningIntelligenceState,
  curriculum: CurriculumContext | null,
): LearningIntelligenceState {
  return { ...state, curriculum };
}
