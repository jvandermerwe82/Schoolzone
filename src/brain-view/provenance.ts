/**
 * Where a number or decision on screen came from.
 *
 * Every Brain Lab panel and every adult-facing card carries one of these, so
 * a viewer can never mistake an illustration for evidence about a real child.
 */
export type DataSource =
  /** The real production engine functions, run on synthetic fixture learners. */
  | 'live-engine-synthetic'
  /** De-identified aggregates from learners whose parents gave separate research consent. */
  | 'consented-pilot-aggregate'
  /** Copy, layout or behaviour written to explain an idea. Not engine output. */
  | 'illustrative-demo';

export interface DataSourceInfo {
  source: DataSource;
  /** Short badge text. */
  label: string;
  /** One sentence for tooltips and the legend. */
  description: string;
  /** True only when the numbers describe real children. */
  describesRealChildren: boolean;
  /** Whether this build can show it at all. */
  availableInThisBuild: boolean;
}

export const DATA_SOURCES: Readonly<Record<DataSource, DataSourceInfo>> = {
  'live-engine-synthetic': {
    source: 'live-engine-synthetic',
    label: 'Live engine (synthetic fixtures)',
    description:
      'Produced by the real SchoolZone planning, learner-model and curriculum-evidence code, run on invented learners. No real child is involved.',
    describesRealChildren: false,
    availableInThisBuild: true,
  },
  'consented-pilot-aggregate': {
    source: 'consented-pilot-aggregate',
    label: 'Consented pilot aggregate',
    description:
      'De-identified totals from families who separately opted in to research. Not connected in this build, so nothing on screen uses it.',
    describesRealChildren: true,
    availableInThisBuild: false,
  },
  'illustrative-demo': {
    source: 'illustrative-demo',
    label: 'Illustrative demo',
    description: 'Explanatory copy or a mocked interaction. It is not engine output and not evidence.',
    describesRealChildren: false,
    availableInThisBuild: true,
  },
};

export const sourceInfo = (source: DataSource): DataSourceInfo => DATA_SOURCES[source];

/**
 * Synthetic learners are always marked, so the lab can refuse a real child record.
 * A real profile id is a random uuid; these can never collide with one.
 */
export const SYNTHETIC_ID_PREFIX = 'synthetic:';
export const SYNTHETIC_NAME_PREFIX = 'Synthetic learner';

export function isSyntheticProfile(profile: { id: string; name: string }): boolean {
  return profile.id.startsWith(SYNTHETIC_ID_PREFIX) && profile.name.startsWith(SYNTHETIC_NAME_PREFIX);
}

export function assertSyntheticProfile(profile: { id: string; name: string }): void {
  if (!isSyntheticProfile(profile)) {
    throw new Error(
      'Brain Lab only runs on synthetic fixture learners. Refusing to read a profile that is not marked synthetic.',
    );
  }
}
