import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({
  path: ['../../.env.local', '../../.env', '.env.local', '.env'],
})

function getMigrationDatabaseUrl(): string {
  // Prioritaskan koneksi direct (unpooled) agar drizzle-kit tidak terkena batasan PgBouncer pada Neon.
  const directUrl = process.env.DIRECT_DATABASE_URL?.trim()
  if (directUrl) {
    return directUrl
  }

  const pooledOrLocalUrl = process.env.DATABASE_URL?.trim()
  if (pooledOrLocalUrl) {
    return pooledOrLocalUrl
  }

  throw new Error(
    'DIRECT_DATABASE_URL or DATABASE_URL is missing. Please configure it in the monorepo root .env.local or .env.',
  )
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  tablesFilter: [
    '!spatial_ref_sys',
    '!geography_columns',
    '!geometry_columns',
    '!raster_columns',
  ],
  dbCredentials: {
    url: getMigrationDatabaseUrl(),
  },
})
