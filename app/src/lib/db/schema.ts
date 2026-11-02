/**
 * The accounts database (a host Postgres beside the `printcraft` supabase
 * schema; loki scripts/hetzner/accounts-db.conf). It holds AccountKit's tables
 * and nothing else: projects, figures and the rest stay in the supabase
 * schema, reached over PostgREST (src/lib/supabase).
 */
export * from '@bitbaum/accountkit/auth/schema';
