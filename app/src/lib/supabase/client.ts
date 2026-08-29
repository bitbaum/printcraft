import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // db.schema: printcraft tables live in their own schema on the shared
  // self-hosted Supabase stack (supabase.orangecat.ch).
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'printcraft' } },
  );
}
