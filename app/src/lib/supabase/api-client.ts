import { createClient } from './server';
import { createAdminClient, GUEST_USER_ID } from './admin';

/**
 * Get a Supabase client and user ID for API routes.
 * If authenticated, uses the user's client (RLS-scoped).
 * If not authenticated, uses the admin client with a guest user ID (bypasses RLS).
 */
export async function getApiClient() {
  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (user) {
    return { supabase: userClient, userId: user.id };
  }

  // No auth — use admin client with guest ID
  return { supabase: createAdminClient(), userId: GUEST_USER_ID };
}
