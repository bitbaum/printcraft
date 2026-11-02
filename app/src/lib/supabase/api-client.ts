import { headers } from 'next/headers';
import { sessionFor } from '@/lib/auth';
import { createAdminClient, GUEST_USER_ID } from './admin';

/**
 * A Supabase client and the caller's user id, for API routes.
 *
 * Who the caller is comes from AccountKit's session (src/lib/auth). The data
 * stays in the `printcraft` supabase schema and is always read through the
 * service-role client, which bypasses row-level security, so every route asks
 * src/lib/api/ownership.ts whether this user may touch the row. A caller who
 * is not signed in is the shared guest, as before.
 */
export async function getApiClient() {
  const session = await sessionFor(await headers()).catch(() => null);
  return { supabase: createAdminClient(), userId: session?.user.id ?? GUEST_USER_ID };
}
