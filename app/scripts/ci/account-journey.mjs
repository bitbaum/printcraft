#!/usr/bin/env node
/**
 * Every way into a PrintCraft account, in a real Chromium against the production
 * build and a PostgreSQL built from the committed migrations
 * (.github/workflows/browser-smoke.yml, run from app/):
 *
 *   - the sign-in and sign-up pages at 320px and 390px: no sideways scroll,
 *     and the method set the env asks for (password, passkey, email link,
 *     recovery, OrangeCat, the bitbaum sign-in);
 *   - sign up through AccountKit's form, sign out, a wrong password refused,
 *     the right one accepted;
 *   - recovery: the reset link from the mail, a new password, the old one
 *     refused, the new one accepted;
 *   - an emailed sign-in link signs in;
 *   - the account page offers passkeys and a second factor.
 *
 * Mail is AccountKit's real mail, caught by scripts/ci/mail-sink.cjs
 * (MAIL_SINK). Synthetic people only.
 *
 *   BASE_URL=http://localhost:3000 MAIL_SINK=… node scripts/ci/account-journey.mjs
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.SMOKE_OUT ?? 'account-journey';
const SINK = process.env.MAIL_SINK;
const run = Date.now().toString(36);
const EMAIL = `journey-${run}@example.test`;
const PASSWORD = `synthetic journey password ${run}`;
const NEW_PASSWORD = `synthetic reset password ${run}`;

/** How many providers the shared sign-in (SIGNIN_ISSUER) publishes; 0 when it cannot be read. */
async function publishedProviders() {
  if (!process.env.SIGNIN_ISSUER) return 0;
  try {
    const r = await fetch(`${process.env.SIGNIN_ISSUER.replace(/\/$/, '')}/api/providers`);
    const { providers } = await r.json();
    return Array.isArray(providers) ? providers.length : 0;
  } catch {
    return 0;
  }
}

const EXPECT = {
  orangecat: Boolean(process.env.ORANGECAT_OAUTH_CLIENT_ID),
  // AccountKit (0.24+) shows the shared sign-in only once Morulia publishes a provider.
  signin: Boolean(process.env.SIGNIN_CLIENT_ID) && (await publishedProviders()) > 0,
  mail: Boolean(SINK),
};

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};
const shot = (page, name) =>
  page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
const session = (page) =>
  page.evaluate(async () => (await (await fetch('/api/auth/get-session')).json())?.user ?? null);
const pathOf = (page) => new URL(page.url()).pathname;
const button = (page, name) =>
  page.getByRole('button', name instanceof RegExp ? { name } : { name, exact: true });
// The shared sign-in's button names the providers Morulia publishes, so its
// words change with Morulia; it always starts the same way.
const SHARED_SIGNIN = /^Continue with Google\b/;

/** The newest link to `route` in a message to `to`, from the mail sink. */
async function mailedLink(to, route) {
  for (let i = 0; i < 30; i++) {
    const lines = (await readFile(SINK, 'utf8').catch(() => '')).split('\n').filter(Boolean);
    for (const line of lines.reverse()) {
      const mail = JSON.parse(line);
      if (![mail.to].flat().includes(to)) continue;
      const html = String(mail.html ?? mail.text ?? '').replaceAll('&amp;', '&');
      const link = html.match(new RegExp(`https?://[^"'\\s<>]*${route}[^"'\\s<>]*`));
      if (link) return link[0];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no ${route} link was mailed to the journey address`);
}

async function signInWithPassword(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.locator('input[autocomplete="username webauthn"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await button(page, 'Sign in').click();
}

async function signOut(page) {
  await page.goto(`${BASE}/`);
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
  await page.waitForURL((url) => url.pathname === '/login', {
    timeout: 30_000,
    waitUntil: 'commit',
  });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(
  process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {},
);
let page;

try {
  // ── Every account page at phone widths: no sideways scroll ─────────────
  for (const width of [320, 390]) {
    const phone = await browser.newPage({ viewport: { width, height: 844 } });
    for (const route of ['/login', '/register']) {
      await phone.goto(`${BASE}${route}`);
      await phone.waitForLoadState('networkidle');
      const overflow = await phone.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      check(overflow <= 0, `${route} at ${width}px has no sideways scroll (${overflow}px)`);
      await shot(phone, `${width}${route.replace(/[/?=]/g, '-')}`);
    }
    await phone.close();
  }

  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  // ── The method set, on the sign-in and the sign-up page ────────────────
  const offered = async (route, labels) => {
    await page.goto(`${BASE}${route}`);
    for (const [name, wanted] of labels) {
      const count = await button(page, name).count();
      check(
        wanted ? count === 1 : count === 0,
        `${route} ${wanted ? 'offers' : 'hides'} "${name}"`,
      );
    }
  };
  await offered('/login', [
    ['Sign in', true],
    ['Sign in with a passkey', true],
    ['Email me a sign-in link instead', EXPECT.mail],
    ['Forgot your password?', EXPECT.mail],
    ['Continue with OrangeCat', EXPECT.orangecat],
    [SHARED_SIGNIN, EXPECT.signin],
  ]);
  await shot(page, 'login-methods');
  await offered('/register', [
    ['Create an account', true],
    ['Email me a link instead', EXPECT.mail],
    ['Continue with OrangeCat', EXPECT.orangecat],
    [SHARED_SIGNIN, EXPECT.signin],
  ]);

  // ── Sign up through AccountKit's form ──────────────────────────────────
  await page.goto(`${BASE}/register?next=/account`);
  await page.locator('input[autocomplete="email"]').fill(EMAIL);
  await page.locator('input[autocomplete="new-password"]').fill(PASSWORD);
  await button(page, 'Create an account').click();
  await page.waitForURL((url) => url.pathname === '/account', {
    timeout: 30_000,
    waitUntil: 'commit',
  });
  check(
    (await session(page))?.email === EMAIL,
    'sign-up signs the new person in, where they were going',
  );
  await shot(page, 'after-sign-up');

  // ── Sign out ───────────────────────────────────────────────────────────
  await signOut(page);
  check((await session(page)) === null, 'sign-out ends the session');
  await page.goto(`${BASE}/account`);
  check(pathOf(page) === '/login', 'the account page sends a signed-out visitor to /login');

  // ── A wrong password is refused, the right one works ───────────────────
  await signInWithPassword(page, EMAIL, 'not the password');
  await page
    .getByText('That email and password do not match')
    .waitFor({ timeout: 30_000, waitUntil: 'commit' });
  check(pathOf(page) === '/login' && (await session(page)) === null, 'a wrong password is refused');
  await shot(page, 'login-refused');

  await signInWithPassword(page, EMAIL, PASSWORD);
  await page.waitForURL((url) => url.pathname === '/projects', {
    timeout: 30_000,
    waitUntil: 'commit',
  });
  check((await session(page))?.email === EMAIL, 'sign-in with the right password works');
  await page.goto(`${BASE}/`);
  await page
    .locator('header a[href="/account"]')
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => {});
  check(
    (await page.locator('header a[href="/account"]').count()) > 0,
    'the header shows the signed-in account',
  );

  // ── The account page: passkeys and a second factor ─────────────────────
  await page.goto(`${BASE}/account`);
  for (const title of ['Passkeys', 'Two-factor sign-in']) {
    check(
      (await page.getByText(title, { exact: true }).count()) > 0,
      `the account page offers ${title}`,
    );
  }
  await shot(page, 'account');
  await signOut(page);

  if (EXPECT.mail) {
    // ── Recovery: the mailed link, a new password ────────────────────────
    await page.goto(`${BASE}/login`);
    await button(page, 'Forgot your password?').click();
    await page.locator('input[autocomplete="email"]').fill(EMAIL);
    await button(page, 'Email me a reset link').click();
    await page
      .getByText('If an account can be recovered')
      .waitFor({ timeout: 30_000, waitUntil: 'commit' });
    check(true, 'the sign-in page sends a reset link');
    await page.goto(await mailedLink(EMAIL, '/api/auth/reset-password/'));
    await page.waitForURL((url) => url.pathname === '/login', {
      timeout: 30_000,
      waitUntil: 'commit',
    });
    await page.locator('input[autocomplete="new-password"]').fill(NEW_PASSWORD);
    check(!page.url().includes('token='), 'the reset token leaves the address bar');
    await button(page, 'Reset password').click();
    await page
      .getByText('Your password has been changed')
      .waitFor({ timeout: 30_000, waitUntil: 'commit' });
    await shot(page, 'reset-done');
    await signInWithPassword(page, EMAIL, PASSWORD);
    await page
      .getByText('That email and password do not match')
      .waitFor({ timeout: 30_000, waitUntil: 'commit' });
    check(true, 'after a reset the old password is refused');
    await signInWithPassword(page, EMAIL, NEW_PASSWORD);
    await page.waitForURL((url) => url.pathname === '/projects', {
      timeout: 30_000,
      waitUntil: 'commit',
    });
    check((await session(page))?.email === EMAIL, 'the new password signs in');
    await signOut(page);

    // ── An emailed sign-in link ──────────────────────────────────────────
    await page.goto(`${BASE}/login`);
    await page.locator('input[autocomplete="username webauthn"]').fill(EMAIL);
    await button(page, 'Email me a sign-in link instead').click();
    await page
      .getByText(`We sent a link to ${EMAIL}`)
      .waitFor({ timeout: 30_000, waitUntil: 'commit' });
    await page.goto(await mailedLink(EMAIL, '/api/auth/magic-link/verify'));
    await page.waitForURL((url) => url.pathname === '/projects', {
      timeout: 30_000,
      waitUntil: 'commit',
    });
    check((await session(page))?.email === EMAIL, 'an emailed sign-in link signs in');
  }

  check(pageErrors.length === 0, `no uncaught page errors (${pageErrors.join(' | ')})`);
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  console.error(error);
  await page?.screenshot({ path: path.join(OUT, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\naccount journey passed');
