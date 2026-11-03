import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const calls: string[] = [];
vi.mock('@/lib/supabase/admin', () => ({
  GUEST_USER_ID: 'fee8f90d-30b0-4b38-9495-c65acd17eef6',
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: async (col: string, v: string) => {
          calls.push(`select ${table} ${col}=${v}`);
          return { data: [{ id: 'p1' }] };
        },
      }),
      delete: () => ({
        eq: async (col: string, v: string) => {
          calls.push(`delete ${table} ${col}=${v}`);
          return { error: null };
        },
      }),
    }),
    storage: {
      from: () => ({
        list: async (prefix: string) => ({
          data: prefix.endsWith('originals') ? [{ name: 'a.jpg' }] : [],
        }),
        remove: async (paths: string[]) => {
          calls.push(`remove ${paths.join(',')}`);
          return {};
        },
      }),
    },
  }),
}));

describe('removing a deleted account’s data', () => {
  beforeEach(() => calls.splice(0));

  it("removes the person's photos and projects, scoped to their id", async () => {
    const { removePersonData } = await import('./deletion');
    await removePersonData('u-1');
    expect(calls).toEqual([
      'select projects user_id=u-1',
      'remove u-1/p1/originals/a.jpg',
      'delete projects user_id=u-1',
    ]);
  });

  it("never touches the shared guest's projects", async () => {
    const { removePersonData } = await import('./deletion');
    await removePersonData('fee8f90d-30b0-4b38-9495-c65acd17eef6');
    expect(calls).toEqual([]);
  });
});
