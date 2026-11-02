import 'server-only';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let db: NodePgDatabase<typeof schema> | undefined;

/** Whether this deployment has an accounts database. */
export const dbConfigured = (env: NodeJS.ProcessEnv = process.env) => Boolean(env.DATABASE_URL);

/** The accounts database, built on first use so pages that never touch it render without one. */
export function getDb(): NodePgDatabase<typeof schema> {
  if (db) return db;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });
  return db;
}
