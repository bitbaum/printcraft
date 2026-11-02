import { defineConfig } from 'drizzle-kit';

/** The accounts database only (src/lib/db/schema.ts); the supabase schema keeps its own supabase/migrations. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
