import '@tanstack/react-start/server-only'

const MIN_AUTH_SECRET_LENGTH = 32

export function getBetterAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim()

  if (!secret) {
    throw new Error(
      'BETTER_AUTH_SECRET is not configured. Set BETTER_AUTH_SECRET (minimum 32 characters) in your environment or root .env.local.',
    )
  }

  if (secret.startsWith('replace-with-')) {
    throw new Error(
      'BETTER_AUTH_SECRET still uses the placeholder value from .env.example. Generate a unique secret with: openssl rand -hex 32',
    )
  }

  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    throw new Error(
      `BETTER_AUTH_SECRET must be at least ${MIN_AUTH_SECRET_LENGTH} characters long.`,
    )
  }

  return secret
}

export function getBetterAuthUrl(): string {
  const rawUrl = process.env.BETTER_AUTH_URL?.trim()

  if (!rawUrl) {
    throw new Error(
      'BETTER_AUTH_URL is not configured. Set BETTER_AUTH_URL (e.g. http://localhost:3000) in your environment or root .env.local.',
    )
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error(
      `BETTER_AUTH_URL "${rawUrl}" is not a valid URL. Include http:// or https://.`,
    )
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `BETTER_AUTH_URL "${rawUrl}" must use http:// or https:// protocol.`,
    )
  }

  return parsed.origin
}
