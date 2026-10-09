/**
 * View models: plain, serialisable shapes that UI components render.
 *
 * Rules for everything in this file:
 * - derived from existing engine state by the pure selectors; never a second
 *   source of truth, never written back to a profile;
 * - no learner name, id, avatar, free text, raw answer or chat;
 * - every estimate that is not authoritative says so in its own field.
 */
import type { CanonicalProgressStatus } from '../brain/canonical-progress';
import type { HelpEvent } from '../brain/help';
import type { PreferenceValue, SupportStrategyId } from '../brain/learning-intelligence';
import type { Reason } from '../brain/tutor';
import type { Level, StrategyId } from '../brain/types';
import type { EvidenceMode } from '../curriculum/types';
import type { AttemptModeInfo } from './evidence-mode';
import type { DataSource } from './provenance';

export type StatusTone = 'none' | 'developing' | 'needs-support' | 'strong' | 'broader' | 'mastered';

export const CANONICAL_STATUS: Readonly<Record<CanonicalProgressStatus, { label: string; tone: StatusTone; gloss: string }>> = {
  'not-started': { label: 'Not started', tone: 'none', gloss: 'No evidence yet.' },
  developing: { label: 'Developing', tone: 'developing', gloss: 'Some evidence, not yet enough to be sure.' },
  'needs-support': { label: 'Needs support', tone: 'needs-support', gloss: 'Direct evidence shows this is hard right now.' },
  'strong-evidence': { label: 'Strong evidence', tone: 'strong', gloss: 'Good results, but the evidence is not yet deep enough to call it mastered.' },
  'requires-broader-evidence': { label: 'Broader evidence needed', tone: 'broader', gloss: 'Quiz answers are strong, but this concept also needs practical or investigative evidence.' },
  mastered: { label: 'Mastered (app evidence)', tone: 'mastered', gloss: 'Strong direct evidence from app questions.' },
};

export interface SkillSnapshot {
  skillId: string;
  name: string;
  /** Elo-style ability on a logit scale (model estimate). */
  ability: number;
  /** Bayesian Knowledge Tracing probability the skill is learned (model estimate, NOT curriculum evidence). */
  pKnown: number;
  attempts: number;
  correct: number;
  /** The engine's own isMastered(): BKT and ability, independent of curriculum evidence. */
  engineMastered: boolean;
  reviewIntervalDays: number;
  nextReviewAt: number | null;
}

export interface CanonicalNodeView {
  nodeId: string;
  title: string;
  strand: string;
  /** Verified Australian Curriculum v9 content code, e.g. AC9M5N05. */
  curriculumCode: string | null;
  /** AUTHORITATIVE curriculum-evidence status from the canonical progress model. */
  status: CanonicalProgressStatus;
  statusLabel: string;
  tone: StatusTone;
  directEvidence: number;
  supportingEvidence: number;
  /** Direct evidence answered with no help. */
  independentDirect: number;
  /** Direct evidence answered with help. Counts toward the status at reduced weight. */
  assistedDirect: number;
  weightedSuccess: number | null;
  confidence: number;
  autoMasterable: boolean;
  evidenceModes: readonly EvidenceMode[];
  /** True when the status leans on helped answers more than the independent-evidence gate allows. */
  reliesOnAssistedEvidence: boolean;
  caveat: string | null;
  /** The executable practice skill for this concept, if SchoolZone has a verified route. */
  practice: { skillId: string; name: string; snapshot: SkillSnapshot; coverage: 'strong' | 'partial' | null; coverageNote: string | null } | null;
}

export interface ConceptNodeView extends CanonicalNodeView {
  depth: number;
  isTarget: boolean;
  isActive: boolean;
  hasExecutableRoute: boolean;
}

export interface ConceptGraphView {
  targetId: string;
  nodes: ConceptNodeView[];
  /** Prerequisite → dependent. */
  edges: { from: string; to: string }[];
  maxDepth: number;
}

export interface RouteStepView {
  title: string;
  kind: 'foundation' | 'target' | 'check';
  state: 'current' | 'next';
}

export interface RouteView {
  reason: 'target' | 'prerequisite';
  targetTitle: string;
  activeTitle: string;
  activeNodeId: string;
  targetNodeId: string;
  practiceSkillId: string;
  practiceLevels: readonly Level[] | null;
  evidenceStrength: 'direct' | 'supporting';
  steps: RouteStepView[];
  /** The line a learner sees: the teacher's goal, the route, and the independent check at the end. */
  learnerLine: string;
}

export interface LevelOption {
  level: Level;
  predicted: number;
  chosen: boolean;
  allowed: boolean;
  closestToTarget: boolean;
}

export interface StrategyOption {
  strategy: StrategyId;
  label: string;
  tried: boolean;
  chosen: boolean;
  /** Routing score used to rank options (success rate plus bounded modifiers). */
  score: number;
  baseScore: number;
  learnerPreference: number;
  parentPreference: number;
  observed: number;
  observedApplied: boolean;
}

export interface StrategyChoiceView {
  chosen: StrategyId;
  options: StrategyOption[];
  /** Why the winner won, in words. */
  because: string;
}

export interface DecisionView {
  reason: Reason;
  reasonLabel: string;
  skillId: string;
  skillName: string;
  level: Level;
  strategy: StrategyId | 'climb' | null;
  strategyLabel: string | null;
  /** The note the learner is shown. */
  learnerMessage: string;
  flags: { diagnostic: boolean; workedExample: boolean; showHint: boolean; resumed: boolean };
  predictedSuccess: number;
  /** Success rate the planner aimed for, or null when a help rule (not a success target) set the level. */
  targetSuccess: number | null;
  levelOptions: LevelOption[];
  why: string[];
}

export interface HelpEpisodeView {
  skillId: string;
  skillName: string;
  stuckLevel: Level;
  phase: StrategyId | 'climb';
  phaseLabel: string;
  tried: StrategyId[];
  helpedBy: StrategyId | null;
  attempts: number;
  startedAt: number;
  /** Plain statement of what ends the episode. */
  endsWhen: string;
}

export type MisconceptionStatus = 'possible-slip' | 'active-pattern' | 'cleared';

export interface MisconceptionView {
  id: string;
  name: string;
  strength: number;
  seen: number;
  status: MisconceptionStatus;
  statusLabel: string;
  /** What the evidence does and does not show. */
  evidenceLabel: string;
  skills: string[];
}

export type ObservedStrength = 'none' | 'limited' | 'repeated';

export interface SupportRow {
  strategy: StrategyId;
  supportId: SupportStrategyId;
  label: string;
  tried: number;
  helped: number;
  /** Helped / tried, only when tried at least once. */
  helpedRate: number | null;
  baseScore: number;
  routingTotal: number;
  /** What the learner or parent SAID helps. A preference, not a result. */
  stated: { learner: PreferenceValue | null; parent: PreferenceValue | null };
  /** What was MEASURED while this support was in use. Observational only. */
  observed: {
    evidenceCount: number;
    confidence: number;
    score: number;
    strength: ObservedStrength;
    strengthLabel: string;
    usedInRouting: boolean;
  };
}

export interface SupportView {
  rows: SupportRow[];
  caution: string;
}

export interface ReviewItemView {
  skillId: string;
  name: string;
  nextReviewAt: number;
  intervalDays: number;
  due: boolean;
  daysUntil: number;
}

export interface ReviewView {
  items: ReviewItemView[];
  dueCount: number;
}

export interface ExplainRow {
  field: string;
  raw: string;
  meaning: string;
}

export interface ContractVersions {
  learningIntelligence: number;
  pilotEvidence: number;
  animatedSupport: number;
  consent: string;
  curriculum: { id: string; name: string; version: string };
  /** Honest note: there is no single Brain policy version constant today. */
  note: string;
}

/** One answered step of a fixture run: the real engine's before/after, ready to draw. */
export interface TraceStepView {
  index: number;
  at: number;
  kind: 'answer';
  decision: DecisionView;
  route: RouteView | null;
  question: { id: string; skillId: string; skillName: string; level: Level; prompt: string; choices: string[] | null };
  input: { given: string; correct: boolean; helped: boolean; timeMs: number };
  attempt: AttemptModeInfo;
  predictedCorrect: number;
  before: SkillSnapshot;
  after: SkillSnapshot;
  result: { misconceptionId: string | null; rapid: boolean; helpEvent: HelpEvent; xp: number };
  strategyChoice: StrategyChoiceView | null;
  episodeAfter: HelpEpisodeView | null;
  misconceptionsAfter: MisconceptionView[];
  /** The concept the route is practising right now (the teacher's goal, or a foundation under it). */
  activeNode: CanonicalNodeView | null;
  /** The teacher's goal. Same as activeNode unless a foundation is being strengthened first. */
  targetNode: CanonicalNodeView | null;
  explain: ExplainRow[];
}

export interface TraceBreakView {
  index: number;
  at: number;
  kind: 'break';
  /** What the synthetic learner did between steps. */
  label: string;
  episodeOpen: boolean;
  /** For a session break with an open episode, the resumed plan the engine produced. */
  resumed: DecisionView | null;
}

export type TraceEntry = TraceStepView | TraceBreakView;

export interface ScenarioMeta {
  id: string;
  title: string;
  summary: string;
  /** What this scenario is meant to demonstrate. */
  demonstrates: string;
  source: DataSource;
}
