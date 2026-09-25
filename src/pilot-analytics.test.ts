import { describe, expect, it } from 'vitest';
import {
  analysePilotCsv,
  parseCsv,
  pilotAnalysisMarkdown,
  type PilotCsvBundle,
} from './pilot-analytics';

const csv = (header: string, rows: string[]) => [header, ...rows].join('\n');

const bundle: PilotCsvBundle = {
  events: csv(
    [
      'learner','event_version','at','session_id','session_position','mission_length',
      'skill','level','item','correct','hinted','rapid','time_ms','predicted',
      'misconception','strategy','plan_reason','help_event','diagnostic','due_review',
      'curriculum_id','canonical_node_id','evidence_strength',
      'teacher_target_node_id','teacher_route_reason',
      'p_known_before','p_known_after','ability_before','ability_after','mastered_after',
    ].join(','),
    [
      'a,1,1,s1,1,2,fractions-y6,2,i1,0,0,0,3000,0.7,frac-add-across,,continue,,0,0,au-ac-v9,pre,direct,target,prerequisite,0.3,0.4,0.1,0.2,0',
      'a,1,2,s1,2,2,fractions-y6,2,i2,1,0,0,3000,0.6,,worked-example,help,resolved,0,0,au-ac-v9,target,direct,target,target,0.4,0.6,0.2,0.5,0',
      'a,1,3,s2,1,3,fractions-y6,3,i3,0,0,0,3000,0.8,,,review,,0,1,au-ac-v9,target,direct,,,0.6,0.5,0.5,0.3,0',
      'a,1,4,s2,2,3,fractions-y6,3,i4,1,1,0,3000,0.65,,hint,help,helped,0,0,au-ac-v9,target,direct,,,0.5,0.7,0.3,0.6,0',
      'b,1,1,s3,1,2,reading-y6,3,i5,1,0,0,2500,0.9,,,continue,,1,1,au-ac-v9,reading,direct,reading,target,0.7,0.8,0.7,0.8,0',
      'b,1,2,s3,2,2,reading-y6,3,i6,1,0,0,2500,0.85,,,continue,,0,0,au-ac-v9,reading,direct,reading,target,0.8,0.9,0.8,1.0,1',
    ],
  ),
  checkpoints: csv(
    'learner,year,subject,form,order,at,skill,level,correct,time_ms',
    [
      'a,5,maths,A,1,10,s,3,1,2000',
      'a,5,maths,A,1,10,s,3,0,2000',
      'a,5,maths,B,2,20,s,3,1,2000',
      'a,5,maths,B,2,20,s,3,1,2000',
      'b,5,maths,B,1,10,s,3,0,2000',
      'b,5,maths,B,1,10,s,3,0,2000',
      'b,5,maths,A,2,20,s,3,1,2000',
      'b,5,maths,A,2,20,s,3,0,2000',
    ],
  ),
  supportPreferences: csv(
    'learner,at,source,strategy,value',
    [
      'a,1,parent,worked-example,prefer',
      'b,1,learner,hint,prefer',
    ],
  ),
  supportOutcomes: csv(
    'learner,at,source,strategy,delta,weight,subject,skill',
    [
      'a,2,observed-learning,worked-example,0.9,0.5,maths,fractions-y6',
      'a,3,observed-learning,hint,0.2,0.5,maths,fractions-y6',
      'b,2,observed-learning,hint,0.8,0.5,english,reading-y6',
    ],
  ),
  engagement: csv(
    'learner,at,kind,subject,skill,value',
    [
      'a,4,stopped-session,maths,fractions-y6,2',
      'b,4,continued-voluntarily,english,reading-y6,2',
      'b,5,continued-voluntarily,english,reading-y6,2',
    ],
  ),
};

describe('Pilot Analytics v1', () => {
  it('parses quoted CSV fields including commas, escaped quotes and newlines', () => {
    const parsed = parseCsv('a,b\n1,"hello, ""world""\nagain"');
    expect(parsed.header).toEqual(['a', 'b']);
    expect(parsed.rows).toEqual([{ a: '1', b: 'hello, "world"\nagain' }]);
  });

  it('calculates paired checkpoint gains by learner and subject', () => {
    const analysis = analysePilotCsv(bundle);
    expect(analysis.learning.pairedLearnerSubjects).toBe(2);
    expect(analysis.learning.overallGainPercentagePoints).toMatchObject({
      n: 2,
      median: 50,
      q1: 50,
      q3: 50,
      min: 50,
      max: 50,
    });
    expect(analysis.learning.bySubject).toHaveLength(1);
    expect(analysis.learning.bySubject[0]).toMatchObject({
      subject: 'maths',
      n: 2,
      median: 50,
      improvedRate: 1,
    });
  });

  it('calculates calibration and independent-answer metrics', () => {
    const analysis = analysePilotCsv(bundle);
    expect(analysis.calibration.answers).toBe(6);
    expect(analysis.calibration.brier).toBeCloseTo(
      ((0.7 ** 2) + (0.4 ** 2) + (0.8 ** 2) + (0.35 ** 2) + (0.1 ** 2) + (0.15 ** 2)) / 6,
      10,
    );
    expect(analysis.independence.cleanUnaidedAnswers).toBe(5);
    expect(analysis.independence.cleanUnaidedCorrectRate).toBe(3 / 5);
    expect(analysis.independence.helpedAnswers).toBe(2);
    expect(analysis.independence.resolvedHelpEvents).toBe(1);
  });

  it('summarises support evidence and stated-prior agreement', () => {
    const analysis = analysePilotCsv(bundle);
    expect(analysis.support.preferences).toBe(2);
    expect(analysis.support.observedOutcomes).toBe(3);
    expect(analysis.support.preferenceBestObservedAgreementN).toBe(2);
    expect(analysis.support.preferenceBestObservedAgreementRate).toBe(1);
    expect(analysis.support.strategyOutcomes[0]).toMatchObject({
      strategy: 'worked-example',
      n: 1,
      weightedMeanDelta: 0.9,
    });
  });

  it('identifies due-review retention and teacher prerequisite return', () => {
    const analysis = analysePilotCsv(bundle);
    expect(analysis.retention).toEqual({
      dueReviews: 2,
      dueReviewSuccessRate: 0.5,
      dueReviewLapseRate: 0.5,
    });
    expect(analysis.teacherIntent).toMatchObject({
      routedAnswers: 4,
      learnersWithTeacherTarget: 2,
      learnerTargetsWithPrerequisiteRoute: 1,
      returnToTargetCount: 1,
      returnToTargetRate: 1,
      medianPrerequisiteAnswersBeforeReturn: 1,
    });
  });

  it('calculates mission completion only for sessions with at least one answer', () => {
    const analysis = analysePilotCsv(bundle);
    expect(analysis.missions).toMatchObject({
      measurableSessions: 3,
      completedSessions: 2,
      completionRate: 2 / 3,
    });
    expect(analysis.missions.medianProgressRate).toBe(1);
    expect(analysis.integrity.warnings.join(' ')).toContain('zero-answer exits');
  });

  it('summarises observable engagement without diagnostic interpretation', () => {
    const analysis = analysePilotCsv(bundle);
    expect(analysis.engagement.countsByKind).toEqual({
      'stopped-session': 1,
      'continued-voluntarily': 2,
    });
    expect(JSON.stringify(analysis)).not.toMatch(/ADHD|autis|dyslex/i);
  });

  it('renders a stable descriptive Markdown scorecard with limitations', () => {
    const report = pilotAnalysisMarkdown(analysePilotCsv(bundle));
    expect(report).toContain('# SchoolZone Pilot Analytics v1');
    expect(report).toContain('50.0 percentage points');
    expect(report).toContain('Teacher intent');
    expect(report).toContain('does not establish causal effectiveness');
    expect(report).toContain('zero-answer exits');
  });

  it('handles empty exports without NaN or fabricated results', () => {
    const empty: PilotCsvBundle = {
      events: 'learner,predicted,correct',
      checkpoints: 'learner,subject,order,correct',
      supportPreferences: 'learner,strategy,value',
      supportOutcomes: 'learner,strategy,delta,weight',
      engagement: 'learner,kind',
    };
    const analysis = analysePilotCsv(empty);
    expect(analysis.calibration.brier).toBeNull();
    expect(analysis.learning.overallGainPercentagePoints.median).toBeNull();
    expect(analysis.missions.completionRate).toBeNull();
    expect(analysis.integrity.warnings.length).toBeGreaterThan(0);
    expect(JSON.stringify(analysis)).not.toContain('NaN');
  });
});
