/**
 * PrintCraft's ways in, on a real Postgres (PGlite) carrying the committed
 * accounts migration, through the runtime the app builds
 * (printcraftAuthOptions): sign-up, sign-out, a wrong password refused,
 * sign-in, a reset through the mailed link, an emailed sign-in link. And the
 * import (scripts/db/accountkit-import.sql): a person who owned projects
 * under their GoTrue id gets an account under that same id, found by
 * OrangeCat's `sub` (their actor id), never by an address.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { placeholderEmail } from '@bitbaum/accountkit/auth';
import { createAuthRuntime } from '@bitbaum/accountkit/auth/next';
import { drizzle } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/lib/db/schema';
import { printcraftAuthOptions } from './options';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const SITE = 'https://printcraft.example.test';
const ENV = {
  NODE_ENV: 'test',
  BETTER_AUTH_URL: SITE,
  BETTER_AUTH_SECRET: 'p'.repeat(48),
  DATABASE_URL: 'pglite',
} as unknown as NodeJS.ProcessEnv;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IMPORT_SQL = readFileSync(
  join(process.cwd(), '..', 'scripts/db/accountkit-import.sql'),
  'utf8',
);

type Mail = { kind: string; to: string; url: string };

async function migrated(): Promise<PGlite> {
  const pg = new PGlite();
  for (const file of readdirSync('drizzle')
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()) {
    for (const sql of readFileSync(`drizzle/${file}`, 'utf8').split('--> statement-breakpoint')) {
      if (sql.trim()) await pg.exec(sql);
    }
  }
  return pg;
}

describe('accounts on the committed migration', () => {
  let pg: PGlite;
  let mail: Mail[];
  let runtime: ReturnType<typeof createAuthRuntime>;

  beforeEach(async () => {
    pg = await migrated();
    const db = drizzle(pg, { schema });
    mail = [];
    runtime = createAuthRuntime(
      printcraftAuthOptions({
        env: ENV,
        getDatabase: () => db as never,
        mail: {
          configured: true,
          send: async (kind, to, url) => void mail.push({ kind, to, url }),
        },
      }),
    );
  });
  afterEach(async () => {
    await pg.close();
  });

  function browser() {
    const jar = new Map<string, string>();
    const cookies = () => new Headers({ cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') });
    async function call(path: string, body?: unknown) {
      const headers = new Headers({ origin: SITE });
      if (jar.size) headers.set('cookie', cookies().get('cookie')!);
      if (body !== undefined) headers.set('content-type', 'application/json');
      const request = new Request(`${SITE}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const response = await (body === undefined ? runtime.GET(request) : runtime.POST(request));
      for (const c of response.headers.getSetCookie()) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        const value = pair.slice(i + 1);
        if (value && !/max-age=0/i.test(c)) jar.set(pair.slice(0, i), value);
        else jar.delete(pair.slice(0, i));
      }
      return response;
    }
    return { call, cookies, session: () => runtime.sessionFor(cookies()) };
  }

  async function landing(b: ReturnType<typeof browser>, url: string): Promise<URL> {
    const u = new URL(url);
    const r = await b.call(u.pathname + u.search);
    expect(r.status).toBe(302);
    return new URL(r.headers.get('location')!, SITE);
  }

  it('signs up with a uuid id, signs out, refuses a wrong password, signs in', async () => {
    const b = browser();
    const up = await b.call('/api/auth/sign-up/email', {
      email: 'neu@example.ch',
      password: 'a photo of us',
      name: '',
    });
    expect(up.status).toBe(200);
    const session = await b.session();
    expect(session?.user.email).toBe('neu@example.ch');
    // projects.user_id is a uuid: a new person's id must fit it.
    expect(session?.user.id).toMatch(UUID);

    expect((await b.call('/api/auth/sign-out', {})).status).toBe(200);
    expect(await b.session()).toBeNull();
    expect(
      (await b.call('/api/auth/sign-in/email', { email: 'neu@example.ch', password: 'wrong' }))
        .status,
    ).toBe(401);
    expect(
      (
        await b.call('/api/auth/sign-in/email', {
          email: 'neu@example.ch',
          password: 'a photo of us',
        })
      ).status,
    ).toBe(200);
    expect((await b.session())?.user.email).toBe('neu@example.ch');
  });

  it('resets a password through the mailed link', async () => {
    const b = browser();
    await b.call('/api/auth/sign-up/email', {
      email: 'reset@example.ch',
      password: 'old one',
      name: '',
    });
    await b.call('/api/auth/sign-out', {});
    await b.call('/api/auth/request-password-reset', {
      email: 'reset@example.ch',
      redirectTo: `${SITE}/login?next=%2Fprojects`,
    });
    const link = mail.find((m) => m.kind === 'reset' && m.to === 'reset@example.ch');
    expect(link).toBeDefined();
    const landed = await landing(b, link!.url);
    expect(landed.pathname).toBe('/login');
    const token = landed.searchParams.get('token');
    expect(
      (await b.call('/api/auth/reset-password', { token, newPassword: 'new one' })).status,
    ).toBe(200);
    expect(
      (await b.call('/api/auth/sign-in/email', { email: 'reset@example.ch', password: 'old one' }))
        .status,
    ).toBe(401);
    expect(
      (await b.call('/api/auth/sign-in/email', { email: 'reset@example.ch', password: 'new one' }))
        .status,
    ).toBe(200);
  });

  it('signs in with an emailed link', async () => {
    const b = browser();
    expect(
      (
        await b.call('/api/auth/sign-in/magic-link', {
          email: 'link@example.ch',
          callbackURL: '/projects',
        })
      ).status,
    ).toBe(200);
    const link = mail.find((m) => m.kind === 'magicLink' && m.to === 'link@example.ch');
    expect((await landing(b, link!.url)).pathname).toBe('/projects');
    expect((await b.session())?.user.email).toBe('link@example.ch');
  });

  it('imports a GoTrue person under their old id, found by their OrangeCat actor id', async () => {
    const OLD_ID = '0b5e2a1c-1111-4111-8111-000000000001';
    const ACTOR = '7c9d8e6f-2222-4222-8222-000000000002';
    const NO_ACTOR = '0b5e2a1c-1111-4111-8111-000000000003';
    const run = async () => {
      await pg.exec(`CREATE TEMP TABLE IF NOT EXISTS oc_people (user_id uuid PRIMARY KEY, actor_id text);
        TRUNCATE oc_people;
        INSERT INTO oc_people VALUES ('${OLD_ID}', '${ACTOR}'), ('${NO_ACTOR}', NULL);`);
      return (await pg.query<Record<string, string>>(IMPORT_SQL, [], { rowMode: 'array' } as never))
        .rows[0] as unknown as string[];
    };
    expect(await run()).toEqual([
      'imported_users=1',
      'imported_orangecat_links=1',
      'already_linked=0',
      'actor_linked_to_another_account=0',
      'without_actor=1',
    ]);
    const { rows: users } = await pg.query<{ id: string; email: string }>(
      'SELECT id, email FROM users',
    );
    // The same id, and the same placeholder AccountKit gives an OrangeCat sign-in.
    expect(users).toEqual([{ id: OLD_ID, email: placeholderEmail('orangecat', ACTOR) }]);

    // What better-auth does at the OIDC callback (handleOAuthUserInfo): find
    // the owner of the account by provider + subject.
    const ctx = await runtime.getAuth().$context;
    const owner = await ctx.internalAdapter.findAccountOwnerByKey({
      providerId: 'orangecat',
      accountId: ACTOR,
    });
    expect(owner?.kind).toBe('owned');
    expect(owner && 'user' in owner ? owner.user.id : null).toBe(OLD_ID);

    // Again: nothing changes, and it says so.
    expect(await run()).toEqual([
      'imported_users=0',
      'imported_orangecat_links=0',
      'already_linked=1',
      'actor_linked_to_another_account=0',
      'without_actor=1',
    ]);
  });
});
