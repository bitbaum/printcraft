import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * /api/compositions was written, authorized and versioned, and then no caller
 * was ever added. The scene background the editor collected lived in a blob URL
 * in React state instead: it disappeared on refresh, and the export went on
 * reporting "print-ready" for a file whose entire background was missing.
 *
 * An endpoint the app never calls is a feature that silently does not exist.
 * This checks the collection path of each route family, so an orphaned endpoint
 * fails here instead of surfacing as lost work.
 */
describe('every API route family has a caller in the app', () => {
  const srcDir = join(process.cwd(), 'src')
  const apiDir = join(srcDir, 'app/api')

  function filesUnder(dir: string, ext: string[]): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return filesUnder(path, ext)
      return ext.some(e => entry.name.endsWith(e)) ? [path] : []
    })
  }

  const routeFamilies = readdirSync(apiDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)

  // Callers live outside the API layer — a route referencing itself proves nothing.
  const callerSources = filesUnder(srcDir, ['.ts', '.tsx'])
    .filter(file => !file.startsWith(apiDir) && !file.endsWith('.test.ts'))
    .map(file => readFileSync(file, 'utf8'))
    .join('\n')

  it('finds the route families', () => {
    expect(routeFamilies.length).toBeGreaterThan(0)
  })

  it.each(routeFamilies)('/api/%s is called from the app', family => {
    expect(callerSources).toContain(`/api/${family}`)
  })
})
