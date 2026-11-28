import { os } from '@orpc/server'

/**
 * Root oRPC router untuk Platform Encounter Sumatra.
 *
 * Status: Placeholder terstruktur (menunggu implementasi prosedur domain:
 * destinasi, tur, profil pengguna, dan manajemen percakapan).
 * Endpoint streaming AI Concierge sementara dilayani via TanStack Start API route (/api/chat).
 */
export const appRouter = os.router({})

export type AppRouter = typeof appRouter
