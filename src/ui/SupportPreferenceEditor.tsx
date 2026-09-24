import type { Profile } from '../brain/types';
import {
  clearSupportPreference,
  emptyLearningIntelligence,
  setSupportPreference,
  summariseSupportStrategy,
  supportPreference,
  type PreferenceSource,
  type PreferenceValue,
} from '../brain/learning-intelligence';
import { supportPreferencesFor } from '../brain/support-preferences';

interface Props {
  profile: Profile;
  source: Extract<PreferenceSource, 'learner' | 'parent'>;
  onSave: (profile: Profile) => void;
  /** Existing access toggles are edited elsewhere in learner Settings. */
  excludeAccessSettings?: boolean;
  showObservedEvidence?: boolean;
}

const confidenceLabel = (confidence: number) =>
  confidence < 0.3 ? 'early evidence' : confidence < 0.6 ? 'developing evidence' : 'stronger repeated evidence';

const evidenceLabel = (score: number) =>
  score > 0.2 ? 'currently looks helpful' : score < -0.2 ? 'has not helped consistently so far' : 'results are mixed so far';

export function SupportPreferenceEditor({
  profile,
  source,
  onSave,
  excludeAccessSettings = false,
  showObservedEvidence = false,
}: Props) {
  const intelligence = profile.learningIntelligence ?? emptyLearningIntelligence();
  const definitions = supportPreferencesFor(source).filter((definition) => !excludeAccessSettings || !definition.accessSetting);

  const change = (strategy: (typeof definitions)[number]['strategy'], value: '' | PreferenceValue) => {
    const definition = definitions.find((item) => item.strategy === strategy)!;
    let next = intelligence;
    if (!value) {
      next = clearSupportPreference(next, strategy, source);
    } else {
      next = setSupportPreference(next, {
        strategy,
        source,
        value,
        at: Date.now(),
      });
    }

    let settings = profile.settings;
    if (definition.accessSetting && value) {
      settings = { ...settings, [definition.accessSetting]: value === 'prefer' };
    }

    onSave({ ...profile, settings, learningIntelligence: next });
  };

  return (
    <section className="card settings-list">
      <h2>{source === 'parent' ? '🧭 What tends to help' : '🧭 How I like to learn'}</h2>
      <p className="muted">
        {source === 'parent'
          ? `Tell SchoolZone what you think helps ${profile.name}. These are preferences to try, not diagnoses or proof. SchoolZone keeps measured learning outcomes separate.`
          : 'Tell SchoolZone what you prefer. It will remember your choices separately from what it later observes actually helping you learn.'}
      </p>
      {definitions.map((definition) => {
        const preference = supportPreference(intelligence, definition.strategy, source);
        const summary = summariseSupportStrategy(intelligence.supportOutcomes, definition.strategy);
        return (
          <div className="strategy-row" key={definition.strategy}>
            <span>
              <strong>{definition.title}</strong><br />
              <small className="muted">{definition.about}</small>
              {showObservedEvidence && summary.evidenceCount > 0 && (
                <><br /><small className="muted">
                  SchoolZone observation: {evidenceLabel(summary.score)} · {confidenceLabel(summary.confidence)} · {summary.evidenceCount} {summary.evidenceCount === 1 ? 'signal' : 'signals'}.
                </small></>
              )}
            </span>
            <select
              aria-label={`${definition.title} preference`}
              value={preference?.value ?? ''}
              onChange={(event) => change(definition.strategy, event.target.value as '' | PreferenceValue)}
            >
              <option value="">No preference</option>
              <option value="prefer">Usually helps</option>
              <option value="avoid">Prefer not</option>
            </select>
          </div>
        );
      })}
      <p className="muted small">
        Preferences never tell SchoolZone that a child has a condition. Repeated learning outcomes are the evidence used to judge whether a support actually helps.
      </p>
    </section>
  );
}
