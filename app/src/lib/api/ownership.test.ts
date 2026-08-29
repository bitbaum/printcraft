import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ownsProject, ownsFigure } from './ownership';

/**
 * Anonymous callers are served by the service-role client so guest mode works
 * without a login, and the service role bypasses RLS. Every route therefore has
 * to check ownership itself; the ids in a request are attacker-controlled.
 */

type Row = Record<string, string>;
type SupabaseArg = Parameters<typeof ownsProject>[0];

function fakeSupabase(tables: Record<string, Row[]>): SupabaseArg {
  const client = {
    from(table: string) {
      const filters: Row = {};
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => {
          filters[column] = value;
          return builder;
        },
        maybeSingle: async () => {
          const rows = tables[table] ?? [];
          const match = rows.find((row) =>
            Object.entries(filters).every(([column, value]) => row[column] === value),
          );
          return { data: match ?? null, error: null };
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseArg;
}

const OWNER = 'owner-1';
const STRANGER = 'stranger-2';

const db = {
  projects: [{ id: 'project-a', user_id: OWNER }],
  figures: [{ id: 'figure-a', project_id: 'project-a' }],
};

describe('ownsProject', () => {
  it('accepts the owner', async () => {
    expect(await ownsProject(fakeSupabase(db), 'project-a', OWNER)).toBe(true);
  });

  it('refuses someone else holding a real project id', async () => {
    expect(await ownsProject(fakeSupabase(db), 'project-a', STRANGER)).toBe(false);
  });

  it('refuses an id that does not exist', async () => {
    expect(await ownsProject(fakeSupabase(db), 'project-nope', OWNER)).toBe(false);
  });
});

describe('ownsFigure', () => {
  it("accepts a figure inside the caller's own project", async () => {
    expect(await ownsFigure(fakeSupabase(db), 'figure-a', OWNER)).toBe(true);
  });

  it("refuses a figure inside somebody else's project", async () => {
    expect(await ownsFigure(fakeSupabase(db), 'figure-a', STRANGER)).toBe(false);
  });

  it('refuses a figure that does not exist', async () => {
    expect(await ownsFigure(fakeSupabase(db), 'figure-nope', OWNER)).toBe(false);
  });

  it('refuses an orphaned figure rather than defaulting to allow', async () => {
    const orphan = { projects: db.projects, figures: [{ id: 'figure-orphan' }] };
    expect(await ownsFigure(fakeSupabase(orphan), 'figure-orphan', OWNER)).toBe(false);
  });
});

/**
 * The hole this file exists to close was one route family being written without
 * the check while its sibling had it. A new route added the same way should
 * fail here rather than in production.
 */
describe('every API route authorizes its caller', () => {
  const apiDir = join(process.cwd(), 'src/app/api');

  function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return routeFiles(path);
      return entry.name === 'route.ts' ? [path] : [];
    });
  }

  const files = routeFiles(apiDir);

  it('finds the route files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(apiDir.length + 1), f]))(
    '%s scopes to the caller',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');
      const scoped =
        source.includes('ownsProject(') ||
        source.includes('ownsFigure(') ||
        source.includes(".eq('user_id', userId)");

      expect(scoped).toBe(true);
    },
  );
});
