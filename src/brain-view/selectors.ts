/**
 * Pure selectors: real engine state in, plain view models out.
 *
 * Nothing here decides anything. Every number comes from the existing engine
 * functions (canonicalProgress, planNext's Plan, nextStrategy,
 * supportRoutingScore, diagnose state, spaced-review fields), and nothing is
 * written back to a profile. If a selector disagrees with the engine, the
 * selector is the bug.
 */
import { canonicalProgress, CANONICAL_STRONG_DIRECT_COUNT } from '../brain/canonical-progress';
import { STRATEGIES, STRATEGY_LABEL, nextStrategy, strategyScore, weakPrerequisite, emptyHelp } from '../brain/help';
import { LEARNING_INTELLIGENCE_VERSION, supportPreference } from '../brain/learning-intelligence';
import { isMastered, guessRate, predictCorrect } from '../brain/model';
import { ACTIVE, getMisconception } from '../brain/misconceptions';
import { itemKey, itemOffset, type ItemStats } from '../brain/items';
import { contextualSupportSummary } from '../brain/rapid-learning';
import {
  HELP_SUPPORT_STRATEGY, ROUTING_MIN_CONFIDENCE, ROUTING_MIN_EVIDENCE, supportRoutingScore,
} from '../brain/support-routing';
import {
  DIAGNOSTIC_TARGET_SUCCESS, RECOVERY_SUCCESS, TARGET_SUCCESS, skillState, type Plan, type Reason,
} from '../brain/tutor';
import { LEVELS, type Level, type Profile, type SkillState, type StrategyId } from '../brain/types';
import { getSkill } from '../content/skills';
import { ANIMATED_SUPPORT_VERSION } from '../content/animated-support';
import { CONSENT_VERSION } from '../consent-version';
import { PILOT_EVIDENCE_VERSION } from '../pilot-evidence';
import { AUSTRALIAN_CURRICULUM_V9 } from '../curriculum/australia';
import { australianCanonicalNode } from '../curriculum/australia-canonical';
import { australianPracticeObjectiveForNode, structuredHomeworkRoute } from '../curriculum/australia-intent-routing';
import type { StructuredHomework } from '../curriculum/australia-teacher-objectives';
import { australianMappingsForSkill } from '../curriculum/australia-v9-mapping';
import { isHelpStrategy, isIndependentRecord } from './evidence-mode';
import type { AttemptModeInfo } from './evidence-mode';
import {
  CANONICAL_STATUS,
  type CanonicalNodeView, type ConceptGraphView, type ConceptNodeView, type ContractVersions,
  type DecisionView, type ExplainRow, type HelpEpisodeView, type LevelOption, type MisconceptionView,
  type ReviewView, type RouteStepView, type RouteView, type SkillSnapshot, type StrategyChoiceView,
  type StrategyOption, type SupportRow, type SupportView,
} from './views';

const CURRICULUM_ID = 'au-ac-v9';
const DAY_MS = 86_400_000;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function snapshotSkill(profile: Profile, skillId: string): SkillSnapshot {
  const state: SkillState = skillState(profile, skillId);
  return {
    skillId,
    name: getSkill(skillId).name,
    ability: state.ability,
    pKnown: state.pKnown,
    attempts: state.attempts,
    correct: state.correct,
    engineMastered: isMastered(state),
    reviewIntervalDays: state.reviewIntervalDays,
    nextReviewAt: state.nextReviewAt,
  };
}

/* ------------------------------------------------------------------ */
/* Curriculum evidence                                                  */
/* ------------------------------------------------------------------ */

const codeOf = (ref: string | undefined): string | null => (ref && ref.includes(':') ? ref.split(':')[1] : null);

export const ASSISTED_CAVEAT =
  'Most of this evidence came from answers with help. Treat it as practice progress until independent answers confirm it.';

/** The authoritative curriculum-evidence status for one concept, split into independent and assisted evidence. */
export function selectCanonicalNode(profile: Profile, nodeId: string): CanonicalNodeView | null {
  const node = australianCanonicalNode(nodeId);
  if (!node) return null;
  const progress = canonicalProgress(node, CURRICULUM_ID, profile.history);

  let independentDirect = 0;
  let assistedDirect = 0;
  for (const answer of profile.history) {
    const evidence = answer.curriculumEvidence?.find(
      (item) => item.curriculumId === CURRICULUM_ID && item.canonicalNodeId === nodeId && item.strength === 'direct',
    );
    if (!evidence || answer.rapid) continue;
    if (isIndependentRecord(answer)) independentDirect++;
    else assistedDirect++;
  }

  const info = CANONICAL_STATUS[progress.status];
  const claimsReady = progress.status === 'mastered' || progress.status === 'strong-evidence' || progress.status === 'requires-broader-evidence';
  const reliesOnAssistedEvidence = claimsReady && independentDirect < CANONICAL_STRONG_DIRECT_COUNT;

  const objective = australianPracticeObjectiveForNode(nodeId);
  let practice: CanonicalNodeView['practice'] = null;
  if (objective) {
    const mapping = australianMappingsForSkill(objective.practiceSkillId)
      .find((m) => node.curriculumRefs.some((ref) => ref.endsWith(m.curriculumRefId) || m.curriculumRefId.endsWith(codeOf(ref) ?? '#')));
    practice = {
      skillId: objective.practiceSkillId,
      name: getSkill(objective.practiceSkillId).name,
      snapshot: snapshotSkill(profile, objective.practiceSkillId),
      coverage: mapping?.coverage ?? null,
      coverageNote: mapping?.rationale ?? null,
    };
  }

  return {
    nodeId,
    title: node.name,
    strand: node.strand,
    curriculumCode: codeOf(node.curriculumRefs[0]),
    status: progress.status,
    statusLabel: info.label,
    tone: info.tone,
    directEvidence: progress.directEvidenceCount,
    supportingEvidence: progress.supportingEvidenceCount,
    independentDirect,
    assistedDirect,
    weightedSuccess: progress.weightedSuccess,
    confidence: progress.confidence,
    autoMasterable: progress.autoMasterable,
    evidenceModes: node.evidenceModes,
    reliesOnAssistedEvidence,
    caveat: reliesOnAssistedEvidence ? ASSISTED_CAVEAT : null,
    practice,
  };
}

/** Prerequisite structure around a target concept, with each concept's real evidence status. */
export function selectConceptGraph(
  profile: Profile,
  targetId: string,
  activeId: string = targetId,
  maxDepth = 3,
): ConceptGraphView {
  const nodes: ConceptNodeView[] = [];
  const edges: { from: string; to: string }[] = [];
  const seen = new Map<string, number>();
  const queue: { id: string; depth: number }[] = [{ id: targetId, depth: 0 }];
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (seen.has(id)) continue;
    const view = selectCanonicalNode(profile, id);
    if (!view) continue;
    seen.set(id, depth);
    nodes.push({
      ...view,
      depth,
      isTarget: id === targetId,
      isActive: id === activeId,
      hasExecutableRoute: !!australianPracticeObjectiveForNode(id),
    });
    if (depth >= maxDepth) continue;
    for (const pre of australianCanonicalNode(id)?.prerequisites ?? []) {
      if (!australianCanonicalNode(pre)) continue;
      edges.push({ from: pre, to: id });
      queue.push({ id: pre, depth: depth + 1 });
    }
  }
  // Lay out by the longest path to the goal, so every arrow points forward.
  const depth = new Map(nodes.map((n) => [n.nodeId, n.depth]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const edge of edges) {
      const need = (depth.get(edge.to) ?? 0) + 1;
      if ((depth.get(edge.from) ?? 0) < need) { depth.set(edge.from, need); changed = true; }
    }
    if (!changed) break;
  }
  for (const node of nodes) node.depth = depth.get(node.nodeId) ?? node.depth;
  return { targetId, nodes, edges, maxDepth: Math.max(0, ...nodes.map((n) => n.depth)) };
}

/** The teacher's goal turned into the route the real router would take for this learner now. */
export function selectRoute(profile: Profile, homework: StructuredHomework): RouteView {
  const route = structuredHomeworkRoute(profile, homework);
  const steps: RouteStepView[] =
    route.reason === 'prerequisite'
      ? [
          { title: route.activeTitle, kind: 'foundation', state: 'current' },
          { title: route.targetTitle, kind: 'target', state: 'next' },
          { title: `A go on your own: ${route.targetTitle}`, kind: 'check', state: 'next' },
        ]
      : [
          { title: route.targetTitle, kind: 'target', state: 'current' },
          { title: `A go on your own: ${route.targetTitle}`, kind: 'check', state: 'next' },
        ];
  const learnerLine =
    route.reason === 'prerequisite'
      ? `Your teacher set: ${route.targetTitle}. First we will strengthen ${route.activeTitle}, then come back to it and finish with a go on your own.`
      : `Your teacher set: ${route.targetTitle}. We will practise it, then finish with a go on your own.`;
  return {
    reason: route.reason,
    targetTitle: route.targetTitle,
    activeTitle: route.activeTitle,
    activeNodeId: route.activeCanonicalNodeId,
    targetNodeId: route.targetCanonicalNodeId,
    practiceSkillId: route.practiceSkillId,
    practiceLevels: route.practiceLevels ?? null,
    evidenceStrength: route.evidenceStrength,
    steps,
    learnerLine,
  };
}

/* ------------------------------------------------------------------ */
/* The planner's decision                                               */
/* ------------------------------------------------------------------ */

const REASON_LABEL: Record<Reason, string> = {
  new: 'New skill',
  continue: 'Keep building',
  review: 'Scheduled review',
  help: 'Helping with a sticking point',
  climb: 'Climbing back up',
};

export interface DecisionContext {
  items?: ItemStats;
  /** Levels a curriculum route permits, if the session is route-locked. */
  allowedLevels?: readonly Level[];
}

/** Why the planner chose this skill, level and kind of help, with every level's predicted success laid out. */
export function selectDecision(profile: Profile, plan: Plan, ctx: DecisionContext = {}): DecisionView {
  const skill = getSkill(plan.skillId);
  const state = skillState(profile, plan.skillId);
  const items = ctx.items ?? {};
  const allowedLevels = ctx.allowedLevels;
  const isAllowed = (level: Level) => !allowedLevels?.length || allowedLevels.includes(level);

  const predictedAt = (level: Level) =>
    predictCorrect(state.ability, level, guessRate(level, skill.choices), itemOffset(items, itemKey({ id: '', skillId: plan.skillId, level })));

  // Which success rate the planner aimed for. Help phases set the level by a
  // rule, not by aiming, except the prerequisite detour which aims for recovery.
  const helpRule = plan.reason === 'help' && plan.strategy !== 'prerequisite';
  const targetSuccess: number | null =
    plan.reason === 'climb' || helpRule ? null
    : plan.strategy === 'prerequisite' ? RECOVERY_SUCCESS
    : plan.diagnostic ? DIAGNOSTIC_TARGET_SUCCESS
    : TARGET_SUCCESS;

  const closest = targetSuccess === null ? null
    : LEVELS.filter(isAllowed).sort((a, b) => Math.abs(predictedAt(a) - targetSuccess) - Math.abs(predictedAt(b) - targetSuccess))[0] ?? null;

  const levelOptions: LevelOption[] = LEVELS.map((level) => ({
    level,
    predicted: predictedAt(level),
    chosen: level === plan.level,
    allowed: isAllowed(level),
    closestToTarget: closest === level,
  }));

  const episode = profile.help?.episode ?? null;
  const why: string[] = [];
  switch (plan.reason) {
    case 'new': why.push(`${skill.name} is unlocked because its earlier skills are ready.`); break;
    case 'continue': why.push(`${skill.name} is started but not yet mastered by the engine's own rule, so practice continues.`); break;
    case 'review': why.push(`${skill.name} was mastered earlier and its scheduled review is due, so it is revisited to stop it fading.`); break;
    case 'help':
      why.push(episode && episode.skillId !== plan.skillId
        ? `The child is stuck on ${getSkill(episode.skillId).name}, so the tutor is practising ${skill.name}, which it builds on.`
        : `The child got stuck on this skill, so the tutor stays with it instead of moving on.`);
      break;
    case 'climb': why.push(`Help worked. The child now works back up towards level ${episode?.stuckLevel ?? plan.level}, with no help.`); break;
  }
  if (plan.strategy && plan.strategy !== 'climb') why.push(`Way of helping: ${STRATEGY_LABEL[plan.strategy]}.`);
  if (plan.diagnostic) why.push('Early placement probe: a slightly harder level than usual to find a starting point quickly.');
  if (targetSuccess !== null) {
    why.push(`Level ${plan.level} is predicted to be answered correctly ${pct(predictedAt(plan.level))} of the time, against an aim of ${pct(targetSuccess)}.`);
    if (closest !== null && closest !== plan.level) why.push(`Level ${closest} is closest to the aim, but level ${plan.level} was served instead (a stretch after a run of unaided correct answers, or a level limit from the teacher route).`);
  } else if (helpRule) {
    why.push(`Level ${plan.level} is set by the help rule rather than by aiming for a success rate.`);
  }
  if (allowedLevels?.length) why.push(`The teacher route only allows levels ${allowedLevels.join(', ')} for this skill.`);

  return {
    reason: plan.reason,
    reasonLabel: REASON_LABEL[plan.reason],
    skillId: plan.skillId,
    skillName: skill.name,
    level: plan.level,
    strategy: plan.strategy ?? null,
    strategyLabel: plan.strategy ? (plan.strategy === 'climb' ? 'Working back up with no help' : STRATEGY_LABEL[plan.strategy]) : null,
    learnerMessage: plan.message,
    flags: {
      diagnostic: !!plan.diagnostic,
      workedExample: !!plan.workedExample,
      showHint: !!plan.showHint,
      resumed: plan.message.startsWith('Last time'),
    },
    predictedSuccess: predictedAt(plan.level),
    targetSuccess,
    levelOptions,
    why,
  };
}

/* ------------------------------------------------------------------ */
/* Choosing a way of helping                                            */
/* ------------------------------------------------------------------ */

/**
 * Re-derive the strategy ranking for a stuck episode by calling the real
 * `nextStrategy` for the winner and the real scoring functions for every
 * option, so the displayed order can never drift from the engine's.
 */
export function selectStrategyChoice(
  profile: Profile,
  episode: { skillId: string; stuckLevel: Level; tried: StrategyId[] },
  now?: number,
): StrategyChoiceView {
  const decided = nextStrategy(profile, episode, now);
  const help = profile.help ?? emptyHelp();
  const prereq = weakPrerequisite(profile, episode.skillId);
  const usable = STRATEGIES.filter((s) => (s !== 'prerequisite' || prereq) && (s !== 'smaller-steps' || episode.stuckLevel > 1));
  const context = { subject: getSkill(episode.skillId).subject, skillId: episode.skillId, now };

  const options: StrategyOption[] = usable.map((strategy) => {
    const base = strategyScore(help, strategy);
    const routing = supportRoutingScore(profile, strategy, base, context);
    return {
      strategy,
      label: STRATEGY_LABEL[strategy],
      tried: decided.tried.includes(strategy),
      chosen: strategy === decided.strategy,
      score: routing.total,
      baseScore: routing.base,
      learnerPreference: routing.learnerPreference,
      parentPreference: routing.parentPreference,
      observed: routing.observed,
      observedApplied: routing.observedApplied,
    };
  }).sort((a, b) => Number(a.tried) - Number(b.tried) || b.score - a.score);

  const winner = options.find((o) => o.chosen)!;
  const untried = options.filter((o) => !o.tried).length;
  const parts = [`Past success with this way of helping: ${pct(winner.baseScore)}`];
  if (winner.learnerPreference) parts.push(`learner preference ${winner.learnerPreference > 0 ? '+' : ''}${winner.learnerPreference.toFixed(2)}`);
  if (winner.parentPreference) parts.push(`parent preference ${winner.parentPreference > 0 ? '+' : ''}${winner.parentPreference.toFixed(2)}`);
  if (winner.observedApplied) parts.push(`measured results ${winner.observed > 0 ? '+' : ''}${winner.observed.toFixed(2)}`);
  const tied = options.filter((o) => !o.tried && !o.chosen && Math.abs(o.score - winner.score) < 1e-9).length;
  const because = tied > 0
    ? `${winner.label} comes first. ${tied === 1 ? 'Another way scores the same' : `${tied} other ways score the same`} (${parts.join(', ')}), so the engine's fixed order decides.`
    : untried <= 1 && decided.tried.length === 0 && episode.tried.length > 0
    ? `Every way of helping had been tried, so a new round starts. Highest score: ${winner.label}.`
    : `${winner.label} has the highest score among the ways not yet tried this time (${parts.join(', ')}).`;

  return { chosen: decided.strategy, options, because };
}

/* ------------------------------------------------------------------ */
/* Help, support, misconceptions, reviews                                */
/* ------------------------------------------------------------------ */

export function selectHelpEpisode(profile: Profile): HelpEpisodeView | null {
  const ep = profile.help?.episode;
  if (!ep) return null;
  const phaseLabel = ep.phase === 'climb' ? 'Working back up with no help' : STRATEGY_LABEL[ep.phase];
  return {
    skillId: ep.skillId,
    skillName: getSkill(ep.skillId).name,
    stuckLevel: ep.stuckLevel,
    phase: ep.phase,
    phaseLabel,
    tried: [...ep.tried],
    helpedBy: ep.helpedBy,
    attempts: ep.attempts,
    startedAt: ep.startedAt,
    endsWhen: `The episode ends only when the child answers a level ${ep.stuckLevel} question correctly with no help. Until then SchoolZone keeps helping and does not move on.`,
  };
}

const STRENGTH_LABEL = {
  none: 'No measurements yet',
  limited: 'Limited evidence, not yet used to choose',
  repeated: 'Repeated evidence',
} as const;

/** What the learner or parent SAID helps, kept apart from what was MEASURED. */
export function selectSupport(profile: Profile, skillId: string, now?: number): SupportView {
  const help = profile.help ?? emptyHelp();
  const state = profile.learningIntelligence;
  const context = { subject: getSkill(skillId).subject, skillId, now };
  const rows: SupportRow[] = STRATEGIES.map((strategy) => {
    const supportId = HELP_SUPPORT_STRATEGY[strategy];
    const record = help.strategies[strategy] ?? { tried: 0, helped: 0 };
    const base = strategyScore(help, strategy);
    const routing = supportRoutingScore(profile, strategy, base, context);
    const summary = state ? contextualSupportSummary(state.supportOutcomes, supportId, context) : null;
    const evidenceCount = summary?.evidenceCount ?? 0;
    const repeated = !!summary && evidenceCount >= ROUTING_MIN_EVIDENCE && summary.confidence >= ROUTING_MIN_CONFIDENCE;
    const strength = evidenceCount === 0 ? 'none' : repeated ? 'repeated' : 'limited';
    return {
      strategy,
      supportId,
      label: STRATEGY_LABEL[strategy],
      tried: record.tried,
      helped: record.helped,
      helpedRate: record.tried > 0 ? record.helped / record.tried : null,
      baseScore: base,
      routingTotal: routing.total,
      stated: {
        learner: state ? supportPreference(state, supportId, 'learner')?.value ?? null : null,
        parent: state ? supportPreference(state, supportId, 'parent')?.value ?? null : null,
      },
      observed: {
        evidenceCount,
        confidence: summary?.confidence ?? 0,
        score: summary?.score ?? 0,
        strength,
        strengthLabel: STRENGTH_LABEL[strength],
        usedInRouting: routing.observedApplied,
      },
    };
  });
  return {
    rows,
    caution: 'Stated preferences are what someone said helps. Measured results are what happened while a support was in use. Neither proves the support caused the change.',
  };
}

/** One wrong answer is a possible slip. A repeated pattern is only claimed from the engine's own threshold. */
export function selectMisconceptions(profile: Profile): MisconceptionView[] {
  const views = Object.entries(profile.misconceptions ?? {}).map(([id, m]): MisconceptionView => {
    const status = m.strength >= ACTIVE ? 'active-pattern' : m.fixedAt !== null ? 'cleared' : 'possible-slip';
    const times = m.seen === 1 ? 'once' : `${m.seen} times`;
    return {
      id,
      name: getMisconception(id).name,
      strength: m.strength,
      seen: m.seen,
      status,
      statusLabel: status === 'active-pattern' ? 'Repeated pattern' : status === 'cleared' ? 'Cleared' : 'Possible slip',
      evidenceLabel:
        status === 'active-pattern'
          ? `Seen ${times}. This is a repeated pattern, so practice now targets it.`
          : status === 'cleared'
            ? `Seen ${times} before, and correct answers since suggest it is no longer happening.`
            : `Seen ${times}. One wrong answer can be a slip, so SchoolZone is watching, not labelling.`,
      skills: [...m.skills],
    };
  });
  const rank = { 'active-pattern': 0, 'possible-slip': 1, cleared: 2 } as const;
  return views.sort((a, b) => rank[a.status] - rank[b.status] || b.strength - a.strength);
}

export function selectReviews(profile: Profile, now: number): ReviewView {
  const items = Object.entries(profile.skills)
    .filter(([, s]) => s.nextReviewAt !== null)
    .map(([skillId, s]) => ({
      skillId,
      name: getSkill(skillId).name,
      nextReviewAt: s.nextReviewAt!,
      intervalDays: s.reviewIntervalDays,
      due: s.nextReviewAt! <= now,
      daysUntil: Math.round(((s.nextReviewAt! - now) / DAY_MS) * 10) / 10,
    }))
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt);
  return { items, dueCount: items.filter((i) => i.due).length };
}

/* ------------------------------------------------------------------ */
/* Explaining one answer                                                */
/* ------------------------------------------------------------------ */

export interface ExplainInput {
  predicted: number;
  before: SkillSnapshot;
  after: SkillSnapshot;
  correct: boolean;
  helped: boolean;
  rapid: boolean;
  misconceptionId: string | null;
  attempt: AttemptModeInfo;
  strategy: StrategyId | 'climb' | null;
}

export function explainAnswer(input: ExplainInput): ExplainRow[] {
  const { before, after } = input;
  const rows: ExplainRow[] = [
    {
      field: 'Chance predicted',
      raw: pct(input.predicted),
      meaning: 'Before the answer, the model estimated this chance of a correct answer from ability and level. A surprise moves the estimate more.',
    },
    {
      field: 'Ability',
      raw: `${before.ability.toFixed(2)} to ${after.ability.toFixed(2)}`,
      meaning: input.rapid
        ? 'A rapid guess moves ability half as much, because it is not a real attempt.'
        : input.helped
          ? 'A helped answer moves ability less than an unaided one.'
          : 'Ability moves towards what the answer shows about what the child can do.',
    },
    {
      field: 'Probably learned',
      raw: `${pct(before.pKnown)} to ${pct(after.pKnown)}`,
      meaning: input.rapid
        ? 'A rapid guess is not treated as evidence, so this does not change.'
        : input.helped
          ? 'A helped answer only adds the chance that practice itself taught something. It is not counted as a right or wrong answer.'
          : 'Knowledge tracing update. It is a model estimate, not curriculum evidence.',
    },
    { field: 'Kind of attempt', raw: input.attempt.label, meaning: input.attempt.explanation },
  ];
  if (input.strategy) {
    rows.push({
      field: 'Help in use',
      raw: input.strategy === 'climb' ? 'Working back up' : STRATEGY_LABEL[input.strategy],
      meaning: isHelpStrategy(input.strategy)
        ? 'Answers during help count as practice. They never count as independent evidence.'
        : 'The child is back to answering without help. The episode ends when they reach the level they got stuck on.',
    });
  }
  if (input.misconceptionId) {
    rows.push({
      field: 'Mistake noticed',
      raw: getMisconception(input.misconceptionId).name,
      meaning: 'This wrong answer matches a known mistake. One match is a possible slip. A repeated pattern is needed before it is treated as active.',
    });
  }
  if (after.engineMastered !== before.engineMastered) {
    rows.push({
      field: 'Engine mastery',
      raw: after.engineMastered ? 'Reached' : 'Lost',
      meaning: 'The engine’s own rule (high chance learned and a strong level 3 prediction). This is separate from curriculum evidence.',
    });
  }
  return rows;
}

export function selectContractVersions(): ContractVersions {
  return {
    learningIntelligence: LEARNING_INTELLIGENCE_VERSION,
    pilotEvidence: PILOT_EVIDENCE_VERSION,
    animatedSupport: ANIMATED_SUPPORT_VERSION,
    consent: CONSENT_VERSION,
    curriculum: { id: AUSTRALIAN_CURRICULUM_V9.id, name: AUSTRALIAN_CURRICULUM_V9.name, version: AUSTRALIAN_CURRICULUM_V9.version },
    note: 'SchoolZone has no single Brain policy version number yet. These are the separate contract versions that exist today.',
  };
}

