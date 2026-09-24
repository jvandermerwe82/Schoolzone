import type { Level, Profile, SubjectId } from '../brain/types';
import type { CanonicalProgressStatus, CanonicalProgressSummary } from '../brain/canonical-progress';
import { australianCanonicalNode, australianCanonicalProgress } from './australia-canonical';
import {
  AUSTRALIAN_TEACHER_OBJECTIVES,
  australianTeacherObjective,
  isStructuredHomework,
  type StructuredHomework,
  type TeacherHomework,
  type TeacherObjectiveDefinition,
} from './australia-teacher-objectives';

const READY_STATUSES = new Set<CanonicalProgressStatus>([
  'mastered',
  'strong-evidence',
  'requires-broader-evidence',
]);

export interface AustralianPracticeRoute {
  reason: 'target' | 'prerequisite';
  targetCanonicalNodeId: string;
  targetTitle: string;
  activeCanonicalNodeId: string;
  activeTitle: string;
  subject: SubjectId;
  practiceSkillId: string;
  practiceLevels?: readonly Level[];
  evidenceStrength: 'direct' | 'supporting';
  targetProgress: CanonicalProgressSummary | null;
  activeProgress: CanonicalProgressSummary | null;
}

export function canonicalProgressIsReady(progress: CanonicalProgressSummary | null): boolean {
  return !!progress && READY_STATUSES.has(progress.status);
}

export function australianPracticeObjectiveForNode(nodeId: string): TeacherObjectiveDefinition | null {
  return AUSTRALIAN_TEACHER_OBJECTIVES.find((objective) => objective.canonicalNodeId === nodeId) ?? null;
}

/**
 * Find the nearest unmet prerequisite for which SchoolZone has a safe,
 * curriculum-precise executable route.
 *
 * We prefer an immediate prerequisite. Only when that concept has no executable
 * route do we search deeper. This avoids sending an older learner needlessly
 * far backwards while still allowing a deeper foundation to be repaired when
 * it is the only safe route available.
 */
function routablePrerequisite(
  profile: Pick<Profile, 'history'>,
  nodeId: string,
  seen = new Set<string>(),
): TeacherObjectiveDefinition | null {
  if (seen.has(nodeId)) return null;
  seen.add(nodeId);

  const node = australianCanonicalNode(nodeId);
  if (!node) return null;

  for (const prerequisiteId of node.prerequisites) {
    const progress = australianCanonicalProgress(profile, prerequisiteId);
    if (canonicalProgressIsReady(progress)) continue;

    const directRoute = australianPracticeObjectiveForNode(prerequisiteId);
    if (directRoute) return directRoute;

    const deeper = routablePrerequisite(profile, prerequisiteId, seen);
    if (deeper) return deeper;
  }

  return null;
}

const routeFromDefinition = (
  profile: Pick<Profile, 'history'>,
  target: TeacherObjectiveDefinition,
  active: TeacherObjectiveDefinition,
  reason: AustralianPracticeRoute['reason'],
): AustralianPracticeRoute => ({
  reason,
  targetCanonicalNodeId: target.canonicalNodeId,
  targetTitle: target.title,
  activeCanonicalNodeId: active.canonicalNodeId,
  activeTitle: active.title,
  subject: active.subject,
  practiceSkillId: active.practiceSkillId,
  practiceLevels: active.practiceLevels,
  evidenceStrength: active.routeStrength,
  targetProgress: australianCanonicalProgress(profile, target.canonicalNodeId),
  activeProgress: australianCanonicalProgress(profile, active.canonicalNodeId),
});

/**
 * Turn a structured teacher destination into the best safe executable route for
 * this learner right now. Legacy homework is intentionally left untouched.
 */
export function routeAustralianTeacherHomework(
  profile: Pick<Profile, 'history'>,
  homework: TeacherHomework,
): AustralianPracticeRoute | null {
  if (!isStructuredHomework(homework)) return null;

  const target = australianTeacherObjective(homework.objectiveId)
    ?? australianPracticeObjectiveForNode(homework.canonicalNodeId);
  if (!target) return null;

  const prerequisite = routablePrerequisite(profile, target.canonicalNodeId);
  return prerequisite
    ? routeFromDefinition(profile, target, prerequisite, 'prerequisite')
    : routeFromDefinition(profile, target, target, 'target');
}

export function structuredHomeworkRoute(
  profile: Pick<Profile, 'history'>,
  homework: StructuredHomework,
): AustralianPracticeRoute {
  return routeAustralianTeacherHomework(profile, homework) ?? {
    reason: 'target',
    targetCanonicalNodeId: homework.canonicalNodeId,
    targetTitle: homework.objective,
    activeCanonicalNodeId: homework.canonicalNodeId,
    activeTitle: homework.objective,
    subject: homework.subject,
    practiceSkillId: homework.practiceSkillId,
    evidenceStrength: 'supporting',
    targetProgress: australianCanonicalProgress(profile, homework.canonicalNodeId),
    activeProgress: australianCanonicalProgress(profile, homework.canonicalNodeId),
  };
}
