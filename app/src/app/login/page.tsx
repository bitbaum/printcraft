import type { Metadata } from 'next';
import { authLabelsFor } from '@bitbaum/accountkit/auth';
import { redirect } from 'next/navigation';
import { AuthPage } from '@/components/auth/AuthPage';
import { PrintcraftSignIn } from '@/components/auth/AuthScreens';
import { authStatus, getSession, methods } from '@/lib/auth';
import { safeNext } from '@/lib/auth/paths';

export const metadata: Metadata = { title: 'Sign in — PrintCraft', robots: { index: false } };

type Search = Promise<{ next?: string; token?: string; error?: string; method?: string }>;

/** Every way in on one screen; the mailed reset link comes back here too. */
export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const query = await searchParams;
  const next = safeNext(query.next);
  const recovering =
    Boolean(query.token) || (query.error === 'INVALID_TOKEN' && query.method !== 'magic-link');
  if (!recovering && (await getSession())) redirect(next);
  return (
    <AuthPage subtitle={recovering ? 'Choose a new password' : 'Scene composer for physical art'}>
      {authStatus().ready ? (
        <PrintcraftSignIn
          labels={authLabelsFor('en')}
          methods={methods()}
          next={next}
          initialError={Boolean(query.error) && !recovering}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Accounts are not available right now. Try again in a little while.
        </p>
      )}
    </AuthPage>
  );
}
