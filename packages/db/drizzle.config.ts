import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({
  path: ['../../.env.local', '../../.env', '.env.local', '.env'],
})

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is missing. Please configure it in the monorepo root .env.local or .env.',
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
    url: databaseUrl,
  },
})
