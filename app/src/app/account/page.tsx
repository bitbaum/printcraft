import type { Metadata } from 'next';
import { authLabelsFor, isDeliverable } from '@bitbaum/accountkit/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthPage } from '@/components/auth/AuthPage';
import { PrintcraftAccount } from '@/components/auth/AuthScreens';
import { getAuth, getSession, methods } from '@/lib/auth';

export const metadata: Metadata = { title: 'Your account — PrintCraft', robots: { index: false } };

/** Name, address, password, passkeys, the second factor, linked sign-ins, deletion. */
export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/account');
  const accounts = await getAuth()
    .api.listUserAccounts({ headers: await headers() })
    .catch(() => [] as { providerId: string }[]);
  const { user } = session;
  return (
    <AuthPage subtitle="Your account">
      <PrintcraftAccount
        labels={authLabelsFor('en')}
        methods={methods()}
        user={{
          name: user.name ?? '',
          email: isDeliverable(user.email) ? user.email : null,
          emailVerified: Boolean(user.emailVerified),
          role: 'customer',
          twoFactorEnabled: Boolean(user.twoFactorEnabled),
        }}
        linked={(accounts as { providerId: string }[]).map((a) => a.providerId)}
      />
    </AuthPage>
  );
}
