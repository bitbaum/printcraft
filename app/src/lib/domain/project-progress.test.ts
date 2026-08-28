import { describe, expect, it } from 'vitest'
import { deriveProjectProgress } from './project-progress'
import { NOT_STARTED_LABEL } from '@/lib/config/project-steps'

const nothing = { figureCount: 0, hasStyle: false, hasSurface: false, hasComposition: false }

describe('deriveProjectProgress', () => {
  it('reports nothing started for an empty project', () => {
    const progress = deriveProjectProgress(nothing)
    expect(progress.completed).toEqual([])
    expect(progress.furthest).toBeNull()
    expect(progress.label).toBe(NOT_STARTED_LABEL)
  })

  it('counts a step only once its rows exist', () => {
    expect(deriveProjectProgress({ ...nothing, figureCount: 1 }).completed).toEqual(['figures'])
    expect(deriveProjectProgress({ ...nothing, hasStyle: true }).completed).toEqual(['style'])
    expect(deriveProjectProgress({ ...nothing, hasSurface: true }).completed).toEqual(['surface'])
    expect(deriveProjectProgress({ ...nothing, hasComposition: true }).completed).toEqual(['compose'])
  })

  it('reports the furthest step reached', () => {
    const progress = deriveProjectProgress({
      figureCount: 3,
      hasStyle: true,
      hasSurface: true,
      hasComposition: true,
    })
    expect(progress.furthest).toBe('compose')
    expect(progress.label).toBe('Composed')
  })

  /** A surface can be defined before any photo is uploaded. */
  it('does not require the earlier steps to report a later one', () => {
    const progress = deriveProjectProgress({ ...nothing, hasSurface: true })
    expect(progress.furthest).toBe('surface')
    expect(progress.label).toBe('Surface set')
  })

  /**
   * The old badge read 'Draft' forever because nothing wrote project.status,
   * and the step nav separately called compose finished as soon as any figure
   * had a styled image. Both now answer from the rows.
   */
  it('does not treat a styled figure as a finished composition', () => {
    const progress = deriveProjectProgress({ ...nothing, figureCount: 4, hasStyle: true })
    expect(progress.completed).not.toContain('compose')
    expect(progress.furthest).toBe('style')
  })

  it('leaves export open until an exports row is written', () => {
    const progress = deriveProjectProgress({
      figureCount: 2,
      hasStyle: true,
      hasSurface: true,
      hasComposition: true,
    })
    expect(progress.completed).not.toContain('export')
  })
})
