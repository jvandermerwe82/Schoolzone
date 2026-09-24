import { getSkill } from '../content/skills';
import { guessRate, predictCorrect } from '../brain/model';
import type { HiddenLearner, LabDecision } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function hiddenSuccessProbability(
  learner: HiddenLearner,
  decision: LabDecision,
): number {
  const skill = getSkill(learner.skillId);
  const base = predictCorrect(
    learner.trueAbility,
    decision.level,
    guessRate(decision.level, skill.choices),
  );
  const strategy = decision.strategy && decision.strategy !== 'climb' ? decision.strategy : null;
  const support = strategy
    ? strategy === learner.preferredStrategy
      ? learner.preferredSupportBoost
      : learner.otherSupportBoost
    : 0;
  return clamp((base + support) * (1 - learner.carelessRate), 0.02, 0.98);
}

const SUPPORTS = ['similar', 'worked-example', 'hint', 'smaller-steps', 'prerequisite'] as const;
const ROOT_SKILLS = ['number-sense', 'living-things', 'spelling-patterns'] as const;
const ABILITIES = [-2, -1.25, -0.5, 0.25, 1, 1.75, 2.5] as const;

/**
 * Deterministic heterogeneous population with hidden academic ability,
 * response noise and preferred interventions.
 */
export function syntheticPopulation(size = 84): HiddenLearner[] {
  return Array.from({ length: size }, (_, index) => ({
    id: `synthetic-${index + 1}`,
    year: 6,
    skillId: ROOT_SKILLS[index % ROOT_SKILLS.length],
    trueAbility: ABILITIES[index % ABILITIES.length],
    carelessRate: 0.01 + (index % 4) * 0.015,
    rapidRate: (index % 5) * 0.01,
    preferredStrategy: SUPPORTS[index % SUPPORTS.length],
    preferredSupportBoost: 0.18 + (index % 3) * 0.03,
    otherSupportBoost: 0.01,
  }));
}
