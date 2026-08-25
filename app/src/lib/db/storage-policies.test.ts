import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The anon key ships in the client bundle. A storage policy that grants anon a
 * destructive verb scoped only by bucket_id therefore grants it to every
 * visitor — "Anon can delete" let anyone remove every uploaded photo in the
 * bucket, which for this product means someone's only copy of a photograph of
 * a person who has died.
 *
 * Migrations are applied by hand here, so this reads them as the record of what
 * production is meant to look like and fails if a destructive grant is left
 * standing.
 */

const MIGRATIONS = join(process.cwd(), 'supabase/migrations')
const DESTRUCTIVE = ['delete', 'update']

function migrationSql(): string {
  return readdirSync(MIGRATIONS)
    .filter(name => name.endsWith('.sql'))
    .sort()
    .map(name => readFileSync(join(MIGRATIONS, name), 'utf8'))
    .join('\n')
}

/** Policy names created for a destructive verb on storage.objects. */
function destructivePolicies(sql: string): string[] {
  const created: string[] = []
  const pattern = /create\s+policy\s+"([^"]+)"\s+on\s+storage\.objects\s+for\s+(\w+)/gi

  for (const match of sql.matchAll(pattern)) {
    const [, name, verb] = match
    if (DESTRUCTIVE.includes(verb.toLowerCase())) created.push(name)
  }
  return created
}

function droppedPolicies(sql: string): Set<string> {
  const dropped = new Set<string>()
  const pattern = /drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+storage\.objects/gi

  for (const match of sql.matchAll(pattern)) dropped.add(match[1])
  return dropped
}

describe('storage policies', () => {
  const sql = migrationSql()

  it('reads the migrations', () => {
    expect(sql).toContain('storage.objects')
  })

  it('leaves no destructive grant standing that is scoped only by bucket', () => {
    const dropped = droppedPolicies(sql)

    // A destructive policy is acceptable only if it also identifies the caller
    // — the ones written for guest mode matched on bucket_id alone.
    const standing = destructivePolicies(sql).filter(name => !dropped.has(name))
    const blanket = standing.filter(name => {
      const body = sql.slice(sql.indexOf(`"${name}"`))
      const clause = body.slice(0, body.indexOf(';'))
      return !clause.includes('auth.uid()')
    })

    expect(blanket).toEqual([])
  })

  it('still lets an anonymous visitor upload, which is what guest mode needs', () => {
    const dropped = droppedPolicies(sql)
    expect(sql).toMatch(/create\s+policy\s+"Anon can upload"\s+on\s+storage\.objects\s+for\s+insert/i)
    expect(dropped.has('Anon can upload')).toBe(false)
  })
})
