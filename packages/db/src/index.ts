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

function createPool(): Pool {
  const newPool = new Pool({
    connectionString: getDatabaseUrl(),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })

  // Neon memutus koneksi idle saat compute scale-to-zero; listener ini mencegah crash unhandled 'error' event.
  newPool.on('error', (error) => {
    console.error('[db] Unexpected error on idle PostgreSQL client:', error)
  })

  return newPool
}

const pool = globalForDb.pgPool ?? createPool()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgPool = pool
}

export const db = drizzle({ client: pool, schema })
export * from './schema'
