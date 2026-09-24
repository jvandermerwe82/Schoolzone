import type { Profile } from '../brain/types';
import {
  clearSupportPreference,
  emptyLearningIntelligence,
  setSupportPreference,
  supportPreference,
  type PreferenceSource,
  type SupportStrategyId,
} from '../brain/learning-intelligence';

export const ACADEMIC_SUPPORT_PRIOR_STRATEGIES = [
  'worked-examples',
  'smaller-steps',
  'graduated-hints',
  'similar-problem',
  'prerequisite-refresh',
] as const satisfies readonly SupportStrategyId[];

type AcademicSupportPriorStrategy = (typeof ACADEMIC_SUPPORT_PRIOR_STRATEGIES)[number];

const LABEL: Record<AcademicSupportPriorStrategy, string> = {
  'worked-examples': 'Show me a worked example',
  'smaller-steps': 'Break it into smaller steps',
  'graduated-hints': 'Give me a hint',
  'similar-problem': 'Try a similar example',
  'prerequisite-refresh': 'Go back and rebuild an earlier skill',
};

export function preferredAcademicSupport(
  profile: Profile,
  source: Extract<PreferenceSource, 'learner' | 'parent'>,
): SupportStrategyId | null {
  const state = profile.learningIntelligence ?? emptyLearningIntelligence();
  return ACADEMIC_SUPPORT_PRIOR_STRATEGIES.find(
    (strategy) => supportPreference(state, strategy, source)?.value === 'prefer',
  ) ?? null;
}

export function shouldPromptLearnerSupportPrior(profile: Profile, maxAnswers = 10): boolean {
  return preferredAcademicSupport(profile, 'learner') === null && profile.history.length < maxAnswers;
}

export function setPreferredAcademicSupport(
  profile: Profile,
  source: Extract<PreferenceSource, 'learner' | 'parent'>,
  selected: SupportStrategyId | null,
  at = Date.now(),
): Profile {
  let state = profile.learningIntelligence ?? emptyLearningIntelligence();

  for (const strategy of ACADEMIC_SUPPORT_PRIOR_STRATEGIES) {
    if (supportPreference(state, strategy, source)?.value === 'prefer') {
      state = clearSupportPreference(state, strategy, source);
    }
  }

  if (selected) {
    state = setSupportPreference(state, {
      strategy: selected,
      source,
      value: 'prefer',
      at,
    });
  }

  return { ...profile, learningIntelligence: state };
}

export function QuickSupportPrior({ profile, source, onSave }: {
  profile: Profile;
  source: Extract<PreferenceSource, 'learner' | 'parent'>;
  onSave: (profile: Profile) => void;
}) {
  const selected = preferredAcademicSupport(profile, source);
  const learner = source === 'learner';

  return (
    <section className="card">
      <h2>🧭 {learner ? 'Help SchoolZone learn you faster' : 'Help SchoolZone learn ' + profile.name + ' faster'}</h2>
      <p className="muted">
        {learner
          ? 'When something gets difficult, what usually helps you most? You can choose “not sure” — SchoolZone will keep learning from what actually works.'
          : 'When ' + profile.name + ' gets stuck, what usually helps most? This is only a starting clue, not a diagnosis or a permanent rule.'}
      </p>
      <label>
        What usually helps most?
        <select
          value={selected ?? ''}
          onChange={(event) => {
            const value = event.target.value as SupportStrategyId | '';
            onSave(setPreferredAcademicSupport(profile, source, value || null));
          }}
        >
          <option value="">Not sure yet</option>
          {ACADEMIC_SUPPORT_PRIOR_STRATEGIES.map((strategy) => (
            <option key={strategy} value={strategy}>{LABEL[strategy]}</option>
          ))}
        </select>
      </label>
      <p className="muted small">SchoolZone checks this against real learning outcomes and can change its mind as it learns more.</p>
    </section>
  );
}
