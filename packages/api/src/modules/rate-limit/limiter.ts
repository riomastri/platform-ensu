import { Ratelimit } from '@upstash/ratelimit'
import type { Redis } from '@upstash/redis'

import { getUpstashRedisClient } from './upstash'

const CHAT_BURST_LIMIT = 10
const CHAT_BURST_WINDOW = '1 m'
const CHAT_DAILY_LIMIT = 100
const CHAT_DAILY_WINDOW = '1 d'

export interface ChatRateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAtMs: number
  retryAfterSec: number
}

interface ChatLimiterPair {
  burst: Ratelimit
  daily: Ratelimit
}

const limiterCache = new WeakMap<Redis, ChatLimiterPair>()

function resolveEnvironmentPrefix(): string {
  return process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
}

function getChatLimiters(): ChatLimiterPair {
  const redis = getUpstashRedisClient()
  const cached = limiterCache.get(redis)
  if (cached) {
    return cached
  }

  const envPrefix = resolveEnvironmentPrefix()

  const burst = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(CHAT_BURST_LIMIT, CHAT_BURST_WINDOW),
    prefix: `rl:chat:${envPrefix}:burst`,
    analytics: false,
  })

  const daily = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(CHAT_DAILY_LIMIT, CHAT_DAILY_WINDOW),
    prefix: `rl:chat:${envPrefix}:daily`,
    analytics: false,
  })

  const pair: ChatLimiterPair = { burst, daily }
  limiterCache.set(redis, pair)
  return pair
}

function computeRetryAfterSeconds(resetAtMs: number): number {
  return Math.max(1, Math.ceil((resetAtMs - Date.now()) / 1000))
}

/**
 * Memeriksa batas laju berlapis (burst per menit + kuota harian) untuk userId terautentikasi.
 * Melempar error jika Upstash gagal/tidak terkonfigurasi agar pemanggil bisa fail-closed (503).
 */
export async function checkChatRateLimit(
  userId: string,
): Promise<ChatRateLimitResult> {
  const normalizedUserId = userId.trim()
  if (!normalizedUserId) {
    throw new Error('userId is required for rate limiting.')
  }

  const { burst, daily } = getChatLimiters()

  const burstResult = await burst.limit(normalizedUserId)
  if (!burstResult.success) {
    return {
      allowed: false,
      limit: burstResult.limit,
      remaining: Math.max(0, burstResult.remaining),
      resetAtMs: burstResult.reset,
      retryAfterSec: computeRetryAfterSeconds(burstResult.reset),
    }
  }

  const dailyResult = await daily.limit(normalizedUserId)
  if (!dailyResult.success) {
    return {
      allowed: false,
      limit: dailyResult.limit,
      remaining: Math.max(0, dailyResult.remaining),
      resetAtMs: dailyResult.reset,
      retryAfterSec: computeRetryAfterSeconds(dailyResult.reset),
    }
  }

  const tighterResult =
    dailyResult.remaining < burstResult.remaining ? dailyResult : burstResult

  return {
    allowed: true,
    limit: tighterResult.limit,
    remaining: Math.max(0, tighterResult.remaining),
    resetAtMs: tighterResult.reset,
    retryAfterSec: 0,
  }
}

/**
 * Membentuk header HTTP standar rate limiting untuk response 200 maupun 429.
 */
export function createRateLimitHeaders(
  result: ChatRateLimitResult,
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAtMs / 1000)),
  }

  if (!result.allowed && result.retryAfterSec > 0) {
    headers['Retry-After'] = String(result.retryAfterSec)
  }

  return headers
}
