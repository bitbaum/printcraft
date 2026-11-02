import type { Metadata } from 'next';
import { authLabelsFor } from '@bitbaum/accountkit/auth';
import { redirect } from 'next/navigation';
import { AuthPage } from '@/components/auth/AuthPage';
import { PrintcraftSignUp } from '@/components/auth/AuthScreens';
import { authStatus, getSession, methods } from '@/lib/auth';
import { safeNext } from '@/lib/auth/paths';

export const metadata: Metadata = {
  title: 'Create an account — PrintCraft',
  robots: { index: false },
};

/** A new account in one step: an email and a password, or any other way in. */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  return (
    <AuthPage subtitle="Create your account">
      {authStatus().ready ? (
        <PrintcraftSignUp labels={authLabelsFor('en')} methods={methods()} next={next} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Accounts are not available right now. Try again in a little while.
        </p>
      )}
    </AuthPage>
  );
}
