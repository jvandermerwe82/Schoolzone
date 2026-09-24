import type { Profile, SubjectId } from './types';
import { supportPreference } from './learning-intelligence';

export const DEFAULT_MISSION_LENGTH = 10;
export const LEARNER_SHORT_MISSION_LENGTH = 6;
export const PARENT_SHORT_MISSION_LENGTH = 7;
export const MIN_ADAPTIVE_MISSION_LENGTH = 5;
export const MAX_ADAPTIVE_MISSION_LENGTH = 8;
export const SESSION_OBSERVED_MIN_SIGNALS = 3;
export const SESSION_SIGNAL_MAX_AGE_DAYS = 60;

export type SessionPolicySource =
  | 'default'
  | 'learner-preference'
  | 'parent-preference'
  | 'observed-fatigue';

export interface SessionPolicy {
  missionLength: number;
  source: SessionPolicySource;
  observedSignals: number;
  confidence: number;
}

const DAY = 86_400_000;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

/**
 * Choose a mission length from explicit preferences first, then repeated
 * behavioural evidence. No diagnosis or condition label is involved.
 */
export function sessionPolicy(
  profile: Profile,
  subject?: SubjectId,
  now = Date.now(),
): SessionPolicy {
  const state = profile.learningIntelligence;
  if (!state) {
    return { missionLength: DEFAULT_MISSION_LENGTH, source: 'default', observedSignals: 0, confidence: 0 };
  }

  const learner = supportPreference(state, 'shorter-missions', 'learner')?.value;
  const parent = supportPreference(state, 'shorter-missions', 'parent')?.value;

  // The learner's own current preference has priority over the parent's.
  if (learner === 'prefer') {
    return {
      missionLength: LEARNER_SHORT_MISSION_LENGTH,
      source: 'learner-preference',
      observedSignals: 0,
      confidence: 1,
    };
  }
  if (learner === 'avoid') {
    return {
      missionLength: DEFAULT_MISSION_LENGTH,
      source: 'learner-preference',
      observedSignals: 0,
      confidence: 1,
    };
  }
  if (parent === 'prefer') {
    return {
      missionLength: PARENT_SHORT_MISSION_LENGTH,
      source: 'parent-preference',
      observedSignals: 0,
      confidence: 0.75,
    };
  }
  if (parent === 'avoid') {
    return {
      missionLength: DEFAULT_MISSION_LENGTH,
      source: 'parent-preference',
      observedSignals: 0,
      confidence: 0.75,
    };
  }

  const cutoff = now - SESSION_SIGNAL_MAX_AGE_DAYS * DAY;
  const signals = state.engagement.filter((signal) =>
    signal.at >= cutoff
    && signal.value !== undefined
    && signal.value > 0
    && (!subject || !signal.subject || signal.subject === subject)
    && (signal.kind === 'stopped-session' || signal.kind === 'rapid-guess'));

  if (signals.length < SESSION_OBSERVED_MIN_SIGNALS) {
    return {
      missionLength: DEFAULT_MISSION_LENGTH,
      source: 'default',
      observedSignals: signals.length,
      confidence: signals.length / SESSION_OBSERVED_MIN_SIGNALS,
    };
  }

  const stopPositions = signals
    .filter((signal) => signal.kind === 'stopped-session')
    .map((signal) => signal.value!)
    .filter((value) => value < DEFAULT_MISSION_LENGTH);
  const rapidPositions = signals
    .filter((signal) => signal.kind === 'rapid-guess')
    .map((signal) => signal.value!)
    .filter((value) => value >= MIN_ADAPTIVE_MISSION_LENGTH);

  const candidates: number[] = [];
  if (stopPositions.length >= 2) candidates.push(median(stopPositions));
  if (rapidPositions.length >= 3) candidates.push(median(rapidPositions) - 1);

  if (candidates.length === 0) {
    return {
      missionLength: DEFAULT_MISSION_LENGTH,
      source: 'default',
      observedSignals: signals.length,
      confidence: Math.min(0.8, signals.length / 10),
    };
  }

  const missionLength = Math.round(clamp(
    Math.min(...candidates),
    MIN_ADAPTIVE_MISSION_LENGTH,
    MAX_ADAPTIVE_MISSION_LENGTH,
  ));
  const confidence = Math.min(0.9, 1 - Math.exp(-signals.length / 5));

  return {
    missionLength,
    source: 'observed-fatigue',
    observedSignals: signals.length,
    confidence,
  };
}
