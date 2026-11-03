import 'server-only';
import { createAuthMailer } from '@bitbaum/accountkit/auth/mail';
import { createAuthRuntime } from '@bitbaum/accountkit/auth/next';
import { signInMethods } from '@bitbaum/accountkit/auth';
import { getDb } from '@/lib/db';
import { removePersonData } from './deletion';
import { authSite, printcraftAuthOptions } from './options';

/**
 * Accounts for PrintCraft: @bitbaum/accountkit, the same account system as
 * every fleet product. Email and password, an emailed sign-in link, passkeys,
 * a second factor, recovery, "Continue with OrangeCat" and the shared sign-in,
 * each offered only when its env is set. AccountKit is the only credential
 * writer; OrangeCat's GoTrue is no longer asked who anyone is.
 */
export const authMail = createAuthMailer({ site: authSite() });
export const mailConfigured = () => authMail.configured;
export const methods = () => signInMethods(process.env, mailConfigured());

export const { GET, POST, getSession, sessionFor, requireUser, authStatus, getAuth } =
  createAuthRuntime({
    ...printcraftAuthOptions({ mail: authMail, getDatabase: () => getDb() }),
    // A deleted account takes its projects and photos, as deleting the
    // auth.users row used to.
    onAccountDeleted: ({ userId }) => removePersonData(userId),
  });
