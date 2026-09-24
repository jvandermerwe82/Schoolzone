import type { PreferenceSource, SupportStrategyId } from './learning-intelligence';

export interface SupportPreferenceDefinition {
  strategy: SupportStrategyId;
  title: string;
  about: string;
  sources: readonly PreferenceSource[];
  /** Existing setting key when the preference also has an immediate UI effect. */
  accessSetting?: 'autoRead' | 'easyRead' | 'bigText' | 'calm';
}

export const SUPPORT_PREFERENCE_DEFINITIONS: readonly SupportPreferenceDefinition[] = [
  {
    strategy: 'read-aloud',
    title: 'Read questions aloud',
    about: 'Hear questions using a voice built into the device.',
    sources: ['learner', 'parent'],
    accessSetting: 'autoRead',
  },
  {
    strategy: 'easier-read-text',
    title: 'Easier-to-read text',
    about: 'Use more spacing and a calmer reading layout.',
    sources: ['learner', 'parent'],
    accessSetting: 'easyRead',
  },
  {
    strategy: 'larger-text',
    title: 'Bigger text',
    about: 'Increase text size throughout SchoolZone.',
    sources: ['learner', 'parent'],
    accessSetting: 'bigText',
  },
  {
    strategy: 'reduced-animation',
    title: 'Calm mode',
    about: 'Reduce animation and pop-up effects.',
    sources: ['learner', 'parent'],
    accessSetting: 'calm',
  },
  {
    strategy: 'shorter-missions',
    title: 'Shorter learning bursts',
    about: 'Prefer shorter chunks of work rather than long runs.',
    sources: ['learner', 'parent'],
  },
  {
    strategy: 'predictable-structure',
    title: 'Know what is coming next',
    about: 'Prefer a clear, predictable session structure.',
    sources: ['learner', 'parent'],
  },
  {
    strategy: 'visible-steps',
    title: 'Keep the steps visible',
    about: 'Prefer instructions and working steps to stay visible.',
    sources: ['learner', 'parent'],
  },
  {
    strategy: 'chunked-instructions',
    title: 'One instruction at a time',
    about: 'Prefer longer instructions broken into smaller chunks.',
    sources: ['learner', 'parent'],
  },
  {
    strategy: 'extended-response-time',
    title: 'More thinking time',
    about: 'Prefer extra processing time before prompts or pressure.',
    sources: ['parent'],
  },
  {
    strategy: 'optional-breaks',
    title: 'Offer breaks',
    about: 'Prefer an option to pause between learning bursts.',
    sources: ['learner', 'parent'],
  },
  {
    strategy: 'worked-examples',
    title: 'Worked examples',
    about: 'Seeing a solved example first often helps.',
    sources: ['learner', 'parent'],
  },
  {
    strategy: 'smaller-steps',
    title: 'Smaller steps',
    about: 'Break a difficult problem into easier steps and build back up.',
    sources: ['learner', 'parent'],
  },
  {
    strategy: 'visual-example',
    title: 'Visual examples',
    about: 'Prefer diagrams or visual examples where the subject allows it.',
    sources: ['learner', 'parent'],
  },
  {
    strategy: 'reduced-visual-density',
    title: 'Less on screen',
    about: 'Prefer fewer competing elements on the screen at one time.',
    sources: ['parent'],
  },
] as const;

export function supportPreferencesFor(source: PreferenceSource): readonly SupportPreferenceDefinition[] {
  return SUPPORT_PREFERENCE_DEFINITIONS.filter((definition) => definition.sources.includes(source));
}
