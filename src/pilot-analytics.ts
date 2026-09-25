export interface CsvTable {
  header: string[];
  rows: Record<string, string>[];
}

export interface PilotCsvBundle {
  events: string;
  checkpoints: string;
  supportPreferences: string;
  supportOutcomes: string;
  engagement: string;
}

export interface DistributionSummary {
  n: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  min: number | null;
  max: number | null;
}

export interface CheckpointSubjectSummary extends DistributionSummary {
  subject: string;
  improvedRate: number | null;
}

export interface CalibrationBin {
  from: number;
  to: number;
  n: number;
  meanPredicted: number | null;
  observedSuccess: number | null;
}

export interface StrategyOutcomeSummary {
  strategy: string;
  n: number;
  totalWeight: number;
  weightedMeanDelta: number | null;
}

export interface PilotAnalysis {
  version: 1;
  integrity: {
    eventRows: number;
    checkpointRows: number;
    supportPreferenceRows: number;
    supportOutcomeRows: number;
    engagementRows: number;
    learnersInEvents: number;
    pilotEvidenceV1Rate: number | null;
    structuredSessionEventRate: number | null;
    warnings: string[];
  };
  learning: {
    pairedLearnerSubjects: number;
    overallGainPercentagePoints: DistributionSummary;
    bySubject: CheckpointSubjectSummary[];
  };
  calibration: {
    answers: number;
    brier: number | null;
    earlyBrierFirst10: number | null;
    laterBrierAfter10: number | null;
    brierImprovement: number | null;
    calibrationGap: number | null;
    bins: CalibrationBin[];
  };
  independence: {
    cleanUnaidedAnswers: number;
    cleanUnaidedCorrectRate: number | null;
    helpedAnswers: number;
    resolvedHelpEvents: number;
    resolvedHelpEventRate: number | null;
  };
  support: {
    preferences: number;
    observedOutcomes: number;
    strategyOutcomes: StrategyOutcomeSummary[];
    preferenceBestObservedAgreementN: number;
    preferenceBestObservedAgreementRate: number | null;
  };
  misconceptions: {
    diagnosedAnswerCount: number;
    learnersWithDiagnosedMisconception: number;
    uniqueMisconceptionIds: number;
  };
  retention: {
    dueReviews: number;
    dueReviewSuccessRate: number | null;
    dueReviewLapseRate: number | null;
  };
  teacherIntent: {
    routedAnswers: number;
    learnersWithTeacherTarget: number;
    learnerTargetsWithPrerequisiteRoute: number;
    returnToTargetCount: number;
    returnToTargetRate: number | null;
    medianPrerequisiteAnswersBeforeReturn: number | null;
  };
  missions: {
    measurableSessions: number;
    completedSessions: number;
    completionRate: number | null;
    medianProgressRate: number | null;
  };
  engagement: {
    countsByKind: Record<string, number>;
  };
}

const num = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const bool = (value: string | undefined): boolean | null => {
  if (value === undefined || value.trim() === '') return null;
  if (value === '1' || value.toLowerCase() === 'true') return true;
  if (value === '0' || value.toLowerCase() === 'false') return false;
  return null;
};

const mean = (values: readonly number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

const quantile = (values: readonly number[], q: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const fraction = position - low;
  return sorted[low] * (1 - fraction) + sorted[high] * fraction;
};

const distribution = (values: readonly number[]): DistributionSummary => ({
  n: values.length,
  median: quantile(values, 0.5),
  q1: quantile(values, 0.25),
  q3: quantile(values, 0.75),
  min: values.length === 0 ? null : Math.min(...values),
  max: values.length === 0 ? null : Math.max(...values),
});

const rate = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

/** RFC-4180-style CSV parser sufficient for SchoolZone's own exports. */
export function parseCsv(text: string): CsvTable {
  const input = text.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    if (row.some((value) => value.length > 0)) records.push(row);
    row = [];
  };

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRow();
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) pushRow();
  const header = records[0] ?? [];
  const rows = records.slice(1).map((record) =>
    Object.fromEntries(header.map((name, index) => [name, record[index] ?? ''])));
  return { header, rows };
}

const rowsFor = (text: string): Record<string, string>[] => parseCsv(text).rows;

const pairedCheckpointGains = (
  rows: readonly Record<string, string>[],
): { gains: number[]; bySubject: Map<string, number[]> } => {
  const groups = new Map<string, Map<number, { correct: number; total: number }>>();

  for (const row of rows) {
    const learner = row.learner;
    const subject = row.subject;
    const order = num(row.order);
    const correct = bool(row.correct);
    if (!learner || !subject || order === null || correct === null) continue;

    const key = `${learner}|${subject}`;
    const byOrder = groups.get(key) ?? new Map<number, { correct: number; total: number }>();
    const bucket = byOrder.get(order) ?? { correct: 0, total: 0 };
    bucket.total++;
    if (correct) bucket.correct++;
    byOrder.set(order, bucket);
    groups.set(key, byOrder);
  }

  const gains: number[] = [];
  const bySubject = new Map<string, number[]>();
  for (const [key, byOrder] of groups) {
    const first = byOrder.get(1);
    const second = byOrder.get(2);
    if (!first?.total || !second?.total) continue;
    const gain = (second.correct / second.total - first.correct / first.total) * 100;
    gains.push(gain);
    const subject = key.split('|')[1];
    const list = bySubject.get(subject) ?? [];
    list.push(gain);
    bySubject.set(subject, list);
  }
  return { gains, bySubject };
};

const brier = (rows: readonly Record<string, string>[]): number | null => {
  const scores: number[] = [];
  for (const row of rows) {
    const predicted = num(row.predicted);
    const correct = bool(row.correct);
    if (predicted === null || correct === null) continue;
    scores.push((predicted - (correct ? 1 : 0)) ** 2);
  }
  return mean(scores);
};

const calibration = (rows: readonly Record<string, string>[]) => {
  const usable = rows.flatMap((row) => {
    const predicted = num(row.predicted);
    const correct = bool(row.correct);
    return predicted === null || correct === null ? [] : [{ predicted, correct: correct ? 1 : 0 }];
  });
  return {
    gap: usable.length === 0
      ? null
      : Math.abs(
          usable.reduce((sum, item) => sum + item.predicted, 0) / usable.length
          - usable.reduce((sum, item) => sum + item.correct, 0) / usable.length,
        ),
    bins: Array.from({ length: 5 }, (_, index): CalibrationBin => {
      const from = index * 0.2;
      const to = index === 4 ? 1 : (index + 1) * 0.2;
      const items = usable.filter((item) =>
        item.predicted >= from && (index === 4 ? item.predicted <= to : item.predicted < to));
      return {
        from,
        to,
        n: items.length,
        meanPredicted: mean(items.map((item) => item.predicted)),
        observedSuccess: mean(items.map((item) => item.correct)),
      };
    }),
  };
};

const earlyLateRows = (rows: readonly Record<string, string>[]) => {
  const byLearner = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    if (!row.learner) continue;
    const list = byLearner.get(row.learner) ?? [];
    list.push(row);
    byLearner.set(row.learner, list);
  }
  const early: Record<string, string>[] = [];
  const later: Record<string, string>[] = [];
  for (const list of byLearner.values()) {
    list.sort((a, b) => (num(a.at) ?? 0) - (num(b.at) ?? 0));
    early.push(...list.slice(0, 10));
    later.push(...list.slice(10));
  }
  return { early, later };
};

const strategyOutcomes = (
  rows: readonly Record<string, string>[],
): StrategyOutcomeSummary[] => {
  const grouped = new Map<string, { n: number; weighted: number; weight: number }>();
  for (const row of rows) {
    const strategy = row.strategy;
    const delta = num(row.delta);
    const weight = num(row.weight);
    if (!strategy || delta === null || weight === null || weight < 0) continue;
    const entry = grouped.get(strategy) ?? { n: 0, weighted: 0, weight: 0 };
    entry.n++;
    entry.weighted += delta * weight;
    entry.weight += weight;
    grouped.set(strategy, entry);
  }
  return [...grouped.entries()]
    .map(([strategy, entry]) => ({
      strategy,
      n: entry.n,
      totalWeight: entry.weight,
      weightedMeanDelta: entry.weight === 0 ? null : entry.weighted / entry.weight,
    }))
    .sort((a, b) => (b.weightedMeanDelta ?? -Infinity) - (a.weightedMeanDelta ?? -Infinity));
};

const preferenceAgreement = (
  preferences: readonly Record<string, string>[],
  outcomes: readonly Record<string, string>[],
): { n: number; rate: number | null } => {
  const observed = new Map<string, Map<string, { weighted: number; weight: number }>>();
  for (const row of outcomes) {
    const learner = row.learner;
    const strategy = row.strategy;
    const delta = num(row.delta);
    const weight = num(row.weight);
    if (!learner || !strategy || delta === null || weight === null || weight <= 0) continue;
    const perLearner = observed.get(learner) ?? new Map();
    const value = perLearner.get(strategy) ?? { weighted: 0, weight: 0 };
    value.weighted += delta * weight;
    value.weight += weight;
    perLearner.set(strategy, value);
    observed.set(learner, perLearner);
  }

  let comparable = 0;
  let agreements = 0;
  for (const row of preferences) {
    if (row.value !== 'prefer' || !row.learner || !row.strategy) continue;
    const strategies = observed.get(row.learner);
    if (!strategies || strategies.size === 0) continue;
    const ranked = [...strategies.entries()]
      .filter(([, value]) => value.weight > 0)
      .map(([strategy, value]) => ({ strategy, score: value.weighted / value.weight }))
      .sort((a, b) => b.score - a.score);
    if (ranked.length === 0) continue;
    comparable++;
    if (ranked[0].strategy === row.strategy) agreements++;
  }
  return { n: comparable, rate: rate(agreements, comparable) };
};

const teacherIntentMetrics = (rows: readonly Record<string, string>[]) => {
  const routed = rows.filter((row) => !!row.teacher_target_node_id);
  const learners = new Set(routed.map((row) => row.learner).filter(Boolean));
  const groups = new Map<string, Record<string, string>[]>();
  for (const row of routed) {
    if (!row.learner || !row.teacher_target_node_id) continue;
    const key = `${row.learner}|${row.teacher_target_node_id}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  let prerequisiteGroups = 0;
  let returned = 0;
  const prereqBeforeReturn: number[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => (num(a.at) ?? 0) - (num(b.at) ?? 0));
    const firstPrereq = list.findIndex((row) => row.teacher_route_reason === 'prerequisite');
    if (firstPrereq < 0) continue;
    prerequisiteGroups++;
    const returnIndex = list.findIndex(
      (row, index) => index > firstPrereq && row.teacher_route_reason === 'target',
    );
    if (returnIndex >= 0) {
      returned++;
      prereqBeforeReturn.push(
        list.slice(firstPrereq, returnIndex).filter((row) => row.teacher_route_reason === 'prerequisite').length,
      );
    }
  }

  return {
    routedAnswers: routed.length,
    learnersWithTeacherTarget: learners.size,
    learnerTargetsWithPrerequisiteRoute: prerequisiteGroups,
    returnToTargetCount: returned,
    returnToTargetRate: rate(returned, prerequisiteGroups),
    medianPrerequisiteAnswersBeforeReturn: quantile(prereqBeforeReturn, 0.5),
  };
};

const missionMetrics = (rows: readonly Record<string, string>[]) => {
  const groups = new Map<string, { maxPosition: number; missionLength: number }>();
  for (const row of rows) {
    if (!row.learner || !row.session_id) continue;
    const position = num(row.session_position);
    const length = num(row.mission_length);
    if (position === null || length === null || length <= 0) continue;
    const key = `${row.learner}|${row.session_id}`;
    const current = groups.get(key) ?? { maxPosition: 0, missionLength: length };
    current.maxPosition = Math.max(current.maxPosition, position);
    current.missionLength = Math.max(current.missionLength, length);
    groups.set(key, current);
  }

  const sessions = [...groups.values()];
  const completed = sessions.filter((session) => session.maxPosition >= session.missionLength).length;
  const progress = sessions.map((session) =>
    Math.min(1, session.maxPosition / Math.max(1, session.missionLength)));
  return {
    measurableSessions: sessions.length,
    completedSessions: completed,
    completionRate: rate(completed, sessions.length),
    medianProgressRate: quantile(progress, 0.5),
  };
};

export function analysePilotCsv(bundle: PilotCsvBundle): PilotAnalysis {
  const events = rowsFor(bundle.events);
  const checkpoints = rowsFor(bundle.checkpoints);
  const preferences = rowsFor(bundle.supportPreferences);
  const outcomes = rowsFor(bundle.supportOutcomes);
  const engagement = rowsFor(bundle.engagement);

  const paired = pairedCheckpointGains(checkpoints);
  const bySubject = [...paired.bySubject.entries()]
    .map(([subject, gains]): CheckpointSubjectSummary => ({
      subject,
      ...distribution(gains),
      improvedRate: rate(gains.filter((gain) => gain > 0).length, gains.length),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  const usableEvents = events.filter((row) => num(row.predicted) !== null && bool(row.correct) !== null);
  const eventLearners = new Set(events.map((row) => row.learner).filter(Boolean));
  const v1 = events.filter((row) => num(row.event_version) === 1).length;
  const structured = events.filter((row) =>
    !!row.session_id && num(row.session_position) !== null && num(row.mission_length) !== null).length;

  const { early, later } = earlyLateRows(usableEvents);
  const earlyBrier = brier(early);
  const laterBrier = brier(later);
  const cal = calibration(usableEvents);

  const clean = events.filter((row) =>
    bool(row.hinted) === false && bool(row.rapid) === false && bool(row.correct) !== null);
  const cleanCorrect = clean.filter((row) => bool(row.correct) === true).length;
  const helped = events.filter((row) =>
    !!row.strategy || row.plan_reason === 'help' || row.plan_reason === 'climb');
  const resolved = events.filter((row) => row.help_event === 'resolved');

  const due = events.filter((row) => bool(row.due_review) === true);
  const dueSuccess = due.filter((row) => bool(row.correct) === true).length;

  const preferenceComparison = preferenceAgreement(preferences, outcomes);
  const teacher = teacherIntentMetrics(events);
  const missions = missionMetrics(events);

  const misconceptionRows = events.filter((row) => !!row.misconception);
  const misconceptionLearners = new Set(misconceptionRows.map((row) => row.learner).filter(Boolean));
  const misconceptionIds = new Set(misconceptionRows.map((row) => row.misconception).filter(Boolean));

  const countsByKind: Record<string, number> = {};
  for (const row of engagement) {
    if (!row.kind) continue;
    countsByKind[row.kind] = (countsByKind[row.kind] ?? 0) + 1;
  }

  const warnings: string[] = [];
  if (events.length === 0) warnings.push('No practice answer events were supplied.');
  if (events.length > 0 && structured < events.length) {
    warnings.push('Some answer rows predate Pilot Evidence v1 or lack mission/session fields.');
  }
  if (paired.gains.length === 0) {
    warnings.push('No paired first/second checkpoint learner-subject results are available yet.');
  }
  if (later.length === 0 && early.length > 0) {
    warnings.push('No learner has more than 10 usable practice answers, so later calibration is unavailable.');
  }
  if (missions.measurableSessions === 0) {
    warnings.push('Mission completion cannot be estimated because no session has both position and planned length.');
  }
  warnings.push('Mission completion covers sessions with at least one recorded answer; zero-answer exits are not measured by Pilot Evidence v1.');
  warnings.push('All results are descriptive unless the pilot study design supplies a valid comparison for causal inference.');

  return {
    version: 1,
    integrity: {
      eventRows: events.length,
      checkpointRows: checkpoints.length,
      supportPreferenceRows: preferences.length,
      supportOutcomeRows: outcomes.length,
      engagementRows: engagement.length,
      learnersInEvents: eventLearners.size,
      pilotEvidenceV1Rate: rate(v1, events.length),
      structuredSessionEventRate: rate(structured, events.length),
      warnings,
    },
    learning: {
      pairedLearnerSubjects: paired.gains.length,
      overallGainPercentagePoints: distribution(paired.gains),
      bySubject,
    },
    calibration: {
      answers: usableEvents.length,
      brier: brier(usableEvents),
      earlyBrierFirst10: earlyBrier,
      laterBrierAfter10: laterBrier,
      brierImprovement:
        earlyBrier === null || laterBrier === null ? null : earlyBrier - laterBrier,
      calibrationGap: cal.gap,
      bins: cal.bins,
    },
    independence: {
      cleanUnaidedAnswers: clean.length,
      cleanUnaidedCorrectRate: rate(cleanCorrect, clean.length),
      helpedAnswers: helped.length,
      resolvedHelpEvents: resolved.length,
      resolvedHelpEventRate: rate(resolved.length, helped.length),
    },
    support: {
      preferences: preferences.length,
      observedOutcomes: outcomes.length,
      strategyOutcomes: strategyOutcomes(outcomes),
      preferenceBestObservedAgreementN: preferenceComparison.n,
      preferenceBestObservedAgreementRate: preferenceComparison.rate,
    },
    misconceptions: {
      diagnosedAnswerCount: misconceptionRows.length,
      learnersWithDiagnosedMisconception: misconceptionLearners.size,
      uniqueMisconceptionIds: misconceptionIds.size,
    },
    retention: {
      dueReviews: due.length,
      dueReviewSuccessRate: rate(dueSuccess, due.length),
      dueReviewLapseRate: rate(due.length - dueSuccess, due.length),
    },
    teacherIntent: teacher,
    missions,
    engagement: { countsByKind },
  };
}

const formatPct = (value: number | null): string =>
  value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`;
const formatNum = (value: number | null, digits = 3): string =>
  value === null ? 'n/a' : value.toFixed(digits);

export function pilotAnalysisMarkdown(analysis: PilotAnalysis): string {
  const gains = analysis.learning.overallGainPercentagePoints;
  const subjectRows = analysis.learning.bySubject.length === 0
    ? '_No paired subject checkpoint data yet._'
    : [
        '| Subject | Paired | Median gain | IQR | Improved |',
        '| --- | ---: | ---: | ---: | ---: |',
        ...analysis.learning.bySubject.map((row) =>
          `| ${row.subject} | ${row.n} | ${formatNum(row.median, 1)} pp | ${formatNum(row.q1, 1)}–${formatNum(row.q3, 1)} pp | ${formatPct(row.improvedRate)} |`),
      ].join('\n');

  const supportRows = analysis.support.strategyOutcomes.length === 0
    ? '_No structured support outcomes yet._'
    : [
        '| Strategy | Evidence rows | Weight | Weighted mean delta |',
        '| --- | ---: | ---: | ---: |',
        ...analysis.support.strategyOutcomes.map((row) =>
          `| ${row.strategy} | ${row.n} | ${formatNum(row.totalWeight, 2)} | ${formatNum(row.weightedMeanDelta, 3)} |`),
      ].join('\n');

  return `# SchoolZone Pilot Analytics v1

> **Descriptive evidence report.** This report does not establish causal effectiveness without an appropriate comparison design.

## Data integrity

- Practice answer rows: **${analysis.integrity.eventRows}**
- Learners in answer events: **${analysis.integrity.learnersInEvents}**
- Pilot Evidence v1 row coverage: **${formatPct(analysis.integrity.pilotEvidenceV1Rate)}**
- Structured mission/session row coverage: **${formatPct(analysis.integrity.structuredSessionEventRate)}**
- Checkpoint rows: **${analysis.integrity.checkpointRows}**
- Support preference rows: **${analysis.integrity.supportPreferenceRows}**
- Support outcome rows: **${analysis.integrity.supportOutcomeRows}**
- Engagement rows: **${analysis.integrity.engagementRows}**

## Learning gain

Paired learner-subject results: **${analysis.learning.pairedLearnerSubjects}**

Overall median checkpoint change: **${formatNum(gains.median, 1)} percentage points**  
IQR: **${formatNum(gains.q1, 1)} to ${formatNum(gains.q3, 1)} pp**

${subjectRows}

## Brain calibration

- Answers with prediction/outcome: **${analysis.calibration.answers}**
- Brier score: **${formatNum(analysis.calibration.brier)}**
- Early Brier (first 10 per learner): **${formatNum(analysis.calibration.earlyBrierFirst10)}**
- Later Brier (after 10): **${formatNum(analysis.calibration.laterBrierAfter10)}**
- Brier improvement: **${formatNum(analysis.calibration.brierImprovement)}**
- Aggregate calibration gap: **${formatPct(analysis.calibration.calibrationGap)}**

## Independent learning

- Clean unaided answers: **${analysis.independence.cleanUnaidedAnswers}**
- Clean unaided correct rate: **${formatPct(analysis.independence.cleanUnaidedCorrectRate)}**
- Help-context answers: **${analysis.independence.helpedAnswers}**
- Resolved help events: **${analysis.independence.resolvedHelpEvents}**
- Resolved/help ratio: **${formatPct(analysis.independence.resolvedHelpEventRate)}**

## Support effectiveness

- Explicit preference rows: **${analysis.support.preferences}**
- Observed support-outcome rows: **${analysis.support.observedOutcomes}**
- Comparable stated-preference vs best-observed cases: **${analysis.support.preferenceBestObservedAgreementN}**
- Agreement rate: **${formatPct(analysis.support.preferenceBestObservedAgreementRate)}**

${supportRows}

## Misconceptions

- Answers with a diagnosed misconception: **${analysis.misconceptions.diagnosedAnswerCount}**
- Learners with diagnosed misconception evidence: **${analysis.misconceptions.learnersWithDiagnosedMisconception}**
- Unique misconception ids observed: **${analysis.misconceptions.uniqueMisconceptionIds}**

## Retention

- Due-review answers: **${analysis.retention.dueReviews}**
- Due-review success rate: **${formatPct(analysis.retention.dueReviewSuccessRate)}**
- Due-review lapse rate: **${formatPct(analysis.retention.dueReviewLapseRate)}**

## Teacher intent

- Routed answer rows: **${analysis.teacherIntent.routedAnswers}**
- Learners with teacher targets: **${analysis.teacherIntent.learnersWithTeacherTarget}**
- Learner-target paths with prerequisite work: **${analysis.teacherIntent.learnerTargetsWithPrerequisiteRoute}**
- Returned to target after prerequisite: **${analysis.teacherIntent.returnToTargetCount}**
- Return-to-target rate: **${formatPct(analysis.teacherIntent.returnToTargetRate)}**
- Median prerequisite answers before return: **${formatNum(analysis.teacherIntent.medianPrerequisiteAnswersBeforeReturn, 1)}**

## Missions

- Measurable missions: **${analysis.missions.measurableSessions}**
- Completed missions: **${analysis.missions.completedSessions}**
- Completion rate: **${formatPct(analysis.missions.completionRate)}**
- Median mission progress: **${formatPct(analysis.missions.medianProgressRate)}**

## Interpretation warnings

${analysis.integrity.warnings.map((warning) => `- ${warning}`).join('\n')}
`;
}
