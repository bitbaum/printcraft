import { PROJECT_STEPS, NOT_STARTED_LABEL, type ProjectStepId } from '@/lib/config/project-steps'

/**
 * What a project has, as far as the app can observe it. These are the rows
 * themselves, not a status column copied from them — a stored status is a
 * second copy of this and drifts the moment any step is undone.
 */
export interface ProjectProgressInput {
  figureCount: number
  hasStyle: boolean
  hasSurface: boolean
  hasComposition: boolean
}

export interface ProjectProgress {
  completed: ProjectStepId[]
  /** Furthest finished step — the one-line answer to "where is this project?" */
  furthest: ProjectStepId | null
  label: string
}

export function deriveProjectProgress(input: ProjectProgressInput): ProjectProgress {
  const completed: ProjectStepId[] = []

  if (input.figureCount > 0) completed.push('figures')
  if (input.hasStyle) completed.push('style')
  if (input.hasSurface) completed.push('surface')
  if (input.hasComposition) completed.push('compose')
  // 'export' is deliberately never derived: nothing writes an exports row yet,
  // so claiming it would be a guess. It stays open until that row is written.

  // Steps can be done out of order, so the badge reports the furthest one
  // reached rather than assuming a contiguous run.
  const furthest =
    [...PROJECT_STEPS].reverse().find(step => completed.includes(step.id))?.id ?? null

  const label = furthest
    ? PROJECT_STEPS.find(step => step.id === furthest)!.doneLabel
    : NOT_STARTED_LABEL

  return { completed, furthest, label }
}
