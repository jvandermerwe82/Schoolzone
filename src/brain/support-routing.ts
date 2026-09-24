import type { Profile, StrategyId } from './types';
import {
  supportPreference,
  type LearningIntelligenceState,
  type SupportStrategyId,
} from './learning-intelligence';
import { contextualSupportSummary, type SupportLearningContext } from './rapid-learning';

export const ROUTING_MIN_EVIDENCE = 3;
export const ROUTING_MIN_CONFIDENCE = 0.3;
export const ROUTING_MAX_OBSERVED_ADJUSTMENT = 0.08;
export const ROUTING_MAX_RAPID_ADJUSTMENT = 0.05;
export const ROUTING_LEARNER_PREFERENCE_ADJUSTMENT = 0.04;
export const ROUTING_PARENT_PREFERENCE_ADJUSTMENT = 0.02;

export const HELP_SUPPORT_STRATEGY: Record<StrategyId, SupportStrategyId> = {
  similar: 'similar-problem',
  'worked-example': 'worked-examples',
  hint: 'graduated-hints',
  'smaller-steps': 'smaller-steps',
  prerequisite: 'prerequisite-refresh',
};

export interface SupportRoutingBreakdown {
  base: number;
  learnerPreference: number;
  parentPreference: number;
  observed: number;
  total: number;
  observedApplied: boolean;
  observedRapid: boolean;
  observedEvidenceCount: number;
  observedExactSkillCount: number;
  observedConfidence: number;
}

const preferenceAdjustment = (
  state: LearningIntelligenceState,
  strategy: SupportStrategyId,
  source: 'learner' | 'parent',
): number => {
  const preference = supportPreference(state, strategy, source)?.value;
  if (!preference || preference === 'neutral') return 0;
  const amount = source === 'learner'
    ? ROUTING_LEARNER_PREFERENCE_ADJUSTMENT
    : ROUTING_PARENT_PREFERENCE_ADJUSTMENT;
  return preference === 'prefer' ? amount : -amount;
};

const observedAdjustment = (
  state: LearningIntelligenceState,
  strategy: SupportStrategyId,
  context: SupportLearningContext,
) => {
  const summary = contextualSupportSummary(state.supportOutcomes, strategy, context);
  const mature = summary.evidenceCount >= ROUTING_MIN_EVIDENCE
    && summary.confidence >= ROUTING_MIN_CONFIDENCE;
  const rapid = !mature && summary.rapidEligible;
  const cap = mature
    ? ROUTING_MAX_OBSERVED_ADJUSTMENT
    : rapid
      ? ROUTING_MAX_RAPID_ADJUSTMENT
      : 0;
  return {
    summary,
    adjustment: cap > 0
      ? Math.max(-cap, Math.min(cap, summary.score * summary.confidence * cap))
      : 0,
    applies: mature || rapid,
    rapid,
  };
};

/**
 * Refine the existing help-success score without replacing it.
 *
 * Existing deterministic history remains the dominant signal. Preferences are
 * small tie-breakers, and measured Learning Intelligence evidence only applies
 * after repeated evidence crosses minimum count and confidence gates.
 */
export function supportRoutingScore(
  profile: Profile,
  strategy: StrategyId,
  baseScore: number,
  context: SupportLearningContext = {},
): SupportRoutingBreakdown {
  const state = profile.learningIntelligence;
  if (!state) {
    return {
      base: baseScore,
      learnerPreference: 0,
      parentPreference: 0,
      observed: 0,
      total: baseScore,
      observedApplied: false,
      observedRapid: false,
      observedEvidenceCount: 0,
      observedExactSkillCount: 0,
      observedConfidence: 0,
    };
  }

  const supportStrategy = HELP_SUPPORT_STRATEGY[strategy];
  const learnerPreference = preferenceAdjustment(state, supportStrategy, 'learner');
  const parentPreference = preferenceAdjustment(state, supportStrategy, 'parent');
  const observed = observedAdjustment(state, supportStrategy, context);
  const total = baseScore + learnerPreference + parentPreference + observed.adjustment;

  return {
    base: baseScore,
    learnerPreference,
    parentPreference,
    observed: observed.adjustment,
    total,
    observedApplied: observed.applies,
    observedRapid: observed.rapid,
    observedEvidenceCount: observed.summary.evidenceCount,
    observedExactSkillCount: observed.summary.exactSkillCount,
    observedConfidence: observed.summary.confidence,
  };
}
