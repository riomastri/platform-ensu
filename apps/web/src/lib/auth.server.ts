import '@tanstack/react-start/server-only'

import { account, db, session, user, verification } from '@encounter/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { getBetterAuthSecret, getBetterAuthUrl } from './auth-env.server'

function createAuth() {
  return betterAuth({
    appName: process.env.APP_TITLE?.trim() || 'Platform Encounter Sumatra',
    baseURL: getBetterAuthUrl(),
    secret: getBetterAuthSecret(),
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user,
        session,
        account,
        verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    plugins: [
      // Wajib diletakkan paling akhir di array plugins agar hook cookie TanStack Start berjalan setelah plugin lain.
      tanstackStartCookies(),
    ],
  })
}

let cachedAuth: ReturnType<typeof createAuth> | null = null

export function getAuth() {
  cachedAuth ??= createAuth()
  return cachedAuth
}
