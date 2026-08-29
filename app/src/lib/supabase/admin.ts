import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS. Use only on the server.
// db.schema: printcraft tables live in their own schema on the shared
// self-hosted Supabase stack (supabase.orangecat.ch).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'printcraft' } },
  );
}

// Re-export for server-side code that already imports from here
export { GUEST_USER_ID } from '@/lib/constants';
