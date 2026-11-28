import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  pgPool?: Pool
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not configured. Set DATABASE_URL in the environment (or root .env.local for local development).',
    )
  }

  return databaseUrl
}

const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: getDatabaseUrl(),
    max: 10,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgPool = pool
}

export const db = drizzle({ client: pool, schema })
export * from './schema'
