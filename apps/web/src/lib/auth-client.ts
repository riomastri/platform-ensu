import { createAuthClient } from 'better-auth/react'

/**
 * Klien autentikasi browser untuk Platform Encounter Sumatra.
 * Tidak men-hardcode baseURL agar otomatis memakai same-origin (/api/auth)
 * baik di development (localhost:3000) maupun di domain production.
 */
export const authClient = createAuthClient()
