import { describe, expect, it } from 'vitest';
import {
  emptyLearningIntelligence,
  recordEngagementSignal,
  recordSupportOutcome,
  setSupportPreference,
} from '../src/brain/learning-intelligence';
import {
  analysePilotCsv,
  parseCsv,
  type PilotCsvBundle,
} from '../src/pilot-analytics';
import { newProfile } from '../src/storage';
import { CONSENT_VERSION } from './app';
import { ADMIN, setup } from './testkit';

describe('Stage-0 Pilot Evidence readiness', () => {
  it('passes a consented synthetic learner through storage, exports and analytics end to end', async () => {
    const { app, signUp, addChild } = setup();
    const { cookie } = await signUp('stage0-parent@example.com');

    const researchConsent = await app.inject({
      method: 'POST',
      url: '/api/consent',
      headers: { cookie },
      payload: {
        version: CONSENT_VERSION,
        dataProcessing: true,
        aiTutor: false,
        research: true,
      },
    });
    expect(researchConsent.statusCode).toBe(200);

    const childId = await addChild(cookie, 'Stage Zero Learner');

    let intelligence = emptyLearningIntelligence();
    intelligence = setSupportPreference(intelligence, {
      strategy: 'worked-examples',
      source: 'parent',
      value: 'prefer',
      at: 10,
      note: 'private note must never leave the profile',
    });
    intelligence = recordSupportOutcome(intelligence, {
      strategy: 'worked-examples',
      source: 'observed-learning',
      at: 20,
      delta: 0.9,
      weight: 0.5,
      subject: 'maths',
      skillId: 'fractions-y6',
    });
    intelligence = recordEngagementSignal(intelligence, {
      kind: 'continued-voluntarily',
      at: 30,
      subject: 'maths',
      skillId: 'fractions-y6',
      value: 2,
    });

    const profile = newProfile('Stage Zero Learner', '🦊', 6);
    profile.id = childId;
    profile.learningIntelligence = intelligence;
    profile.checkpoints = [
      {
        subject: 'maths',
        form: 'A',
        at: 100,
        answers: [
          { skillId: 'fractions-y6', level: 2, questionId: 'pre-1', correct: false, timeMs: 3000 },
          { skillId: 'fractions-y6', level: 4, questionId: 'pre-2', correct: false, timeMs: 3200 },
        ],
      },
      {
        subject: 'maths',
        form: 'B',
        at: 200,
        answers: [
          { skillId: 'fractions-y6', level: 2, questionId: 'post-1', correct: true, timeMs: 2800 },
          { skillId: 'fractions-y6', level: 4, questionId: 'post-2', correct: false, timeMs: 3100 },
        ],
      },
    ];

    const save = await app.inject({
      method: 'PUT',
      url: `/api/children/${childId}`,
      headers: { cookie },
      payload: { profile, version: 1 },
    });
    expect(save.statusCode).toBe(200);

    const events = [
      {
        at: 1000,
        skillId: 'fractions-y6',
        level: 2,
        itemKey: 'fractions-y6:L2',
        correct: false,
        hinted: false,
        rapid: false,
        timeMs: 3500,
        predicted: 0.55,
        misconception: 'frac-add-across',
        strategy: null,
        eventVersion: 1,
        sessionId: 'm-stage0',
        sessionPosition: 1,
        missionLength: 2,
        planReason: 'continue',
        helpEvent: null,
        diagnostic: false,
        dueReview: false,
        curriculumId: 'au-ac-v9',
        canonicalNodeId: 'math.fractions.add-subtract-related',
        evidenceStrength: 'direct',
        teacherTargetNodeId: 'math.fractions.add-subtract-equivalent',
        teacherRouteReason: 'prerequisite',
        pKnownBefore: 0.30,
        pKnownAfter: 0.38,
        abilityBefore: -0.2,
        abilityAfter: -0.1,
        masteredAfter: false,
      },
      {
        at: 2000,
        skillId: 'fractions-y6',
        level: 2,
        itemKey: 'fractions-y6:L2',
        correct: true,
        hinted: false,
        rapid: false,
        timeMs: 3100,
        predicted: 0.65,
        misconception: null,
        strategy: 'worked-example',
        eventVersion: 1,
        sessionId: 'm-stage0',
        sessionPosition: 2,
        missionLength: 2,
        planReason: 'help',
        helpEvent: 'resolved',
        diagnostic: false,
        dueReview: false,
        curriculumId: 'au-ac-v9',
        canonicalNodeId: 'math.fractions.add-subtract-equivalent',
        evidenceStrength: 'direct',
        teacherTargetNodeId: 'math.fractions.add-subtract-equivalent',
        teacherRouteReason: 'target',
        pKnownBefore: 0.38,
        pKnownAfter: 0.62,
        abilityBefore: -0.1,
        abilityAfter: 0.25,
        masteredAfter: false,
      },
    ];

    const stored = await app.inject({
      method: 'POST',
      url: `/api/children/${childId}/events`,
      headers: { cookie },
      payload: { events },
    });
    expect(stored.statusCode).toBe(200);
    expect(stored.json()).toEqual({ ok: true, stored: 2 });

    const getCsv = async (path: string) => {
      const response = await app.inject({ method: 'GET', url: path, headers: ADMIN });
      expect(response.statusCode).toBe(200);
      return response.body;
    };

    const bundle: PilotCsvBundle = {
      events: await getCsv('/api/admin/events.csv'),
      checkpoints: await getCsv('/api/admin/checkpoints.csv'),
      supportPreferences: await getCsv('/api/admin/support-preferences.csv'),
      supportOutcomes: await getCsv('/api/admin/support-outcomes.csv'),
      engagement: await getCsv('/api/admin/engagement.csv'),
    };

    const learnerIds = [
      parseCsv(bundle.events).rows[0]?.learner,
      parseCsv(bundle.checkpoints).rows[0]?.learner,
      parseCsv(bundle.supportPreferences).rows[0]?.learner,
      parseCsv(bundle.supportOutcomes).rows[0]?.learner,
      parseCsv(bundle.engagement).rows[0]?.learner,
    ];
    expect(new Set(learnerIds).size).toBe(1);
    expect(learnerIds[0]).toMatch(/^[a-f0-9]{16}$/);

    for (const exported of Object.values(bundle)) {
      expect(exported).not.toContain(childId);
      expect(exported).not.toContain('Stage Zero Learner');
      expect(exported).not.toContain('stage0-parent@example.com');
      expect(exported).not.toContain('private note must never leave the profile');
    }

    const analysis = analysePilotCsv(bundle);
    expect(analysis.integrity.stage0).toEqual({ pass: true, failures: [] });
    expect(analysis.integrity.eventRows).toBe(2);
    expect(analysis.learning.pairedLearnerSubjects).toBe(1);
    expect(analysis.learning.overallGainPercentagePoints.median).toBe(50);
    expect(analysis.missions).toMatchObject({
      measurableSessions: 1,
      completedSessions: 1,
      completionRate: 1,
    });
    expect(analysis.teacherIntent).toMatchObject({
      learnerTargetsWithPrerequisiteRoute: 1,
      returnToTargetCount: 1,
      returnToTargetRate: 1,
    });
    expect(analysis.support.preferenceBestObservedAgreementRate).toBe(1);
    expect(analysis.engagement.countsByKind).toEqual({
      'continued-voluntarily': 1,
    });
  });
});
