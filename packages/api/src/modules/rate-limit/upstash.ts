import { Redis } from '@upstash/redis'

const UPSTASH_REQUEST_TIMEOUT_MS = 3000

export class RateLimitConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitConfigurationError'
  }
}

interface CachedRedisClient {
  client: Redis
  url: string
  token: string
}

let cachedRedisClient: CachedRedisClient | null = null

function getUpstashConfig(): { url: string; token: string } {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

  if (!url || url.startsWith('https://replace-with-')) {
    throw new RateLimitConfigurationError(
      'UPSTASH_REDIS_REST_URL is not configured with a valid Upstash endpoint.',
    )
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new RateLimitConfigurationError(
      `UPSTASH_REDIS_REST_URL "${url}" is not a valid URL.`,
    )
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new RateLimitConfigurationError(
      'UPSTASH_REDIS_REST_URL must use https:// protocol.',
    )
  }

  if (!token || token.startsWith('replace-with-')) {
    throw new RateLimitConfigurationError(
      'UPSTASH_REDIS_REST_TOKEN is not configured.',
    )
  }

  return {
    url: parsedUrl.origin,
    token,
  }
}

/**
 * Mengembalikan singleton Redis REST client untuk Upstash.
 * Melempar RateLimitConfigurationError secara fail-closed bila env belum disetel.
 */
export function getUpstashRedisClient(): Redis {
  const { url, token } = getUpstashConfig()

  if (
    cachedRedisClient &&
    cachedRedisClient.url === url &&
    cachedRedisClient.token === token
  ) {
    return cachedRedisClient.client
  }

  const client = new Redis({
    url,
    token,
    // Fresh per-request AbortSignal prevents singleton expiry while aborting hung HTTP requests.
    signal: () => AbortSignal.timeout(UPSTASH_REQUEST_TIMEOUT_MS),
    // Fast-fail retry so /api/chat fails closed (503) promptly on Upstash outages.
    retry: {
      retries: 1,
      backoff: (retryCount) => retryCount * 150,
    },
  })
  cachedRedisClient = { client, url, token }
  return client
}
