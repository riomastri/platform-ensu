import {
  createOpenRouterText,
  type ProviderPreferences,
} from '@tanstack/ai-openrouter'

export type AiTaskTier = 'tier1_chat_extract' | 'tier2_itinerary_tools'
export type OpenRouterTextModel = Parameters<typeof createOpenRouterText>[0]

export interface ConciergeModelOptions {
  strictDataPrivacy?: boolean
}

const DEFAULT_FREE_MODEL: OpenRouterTextModel =
  'nvidia/nemotron-3-ultra-550b-a55b:free'

const FREE_DEV_MODELS: Record<AiTaskTier, OpenRouterTextModel> = {
  tier1_chat_extract: DEFAULT_FREE_MODEL,
  tier2_itinerary_tools: DEFAULT_FREE_MODEL,
}

const PRODUCTION_MODELS: Record<AiTaskTier, OpenRouterTextModel> = {
  tier1_chat_extract: 'nvidia/nemotron-3-nano-30b-a3b',
  tier2_itinerary_tools: 'nvidia/nemotron-3-ultra-550b-a55b',
}

const ALLOWED_ENV_MODELS: ReadonlySet<OpenRouterTextModel> =
  new Set<OpenRouterTextModel>([
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3-nano-30b-a3b',
    'nvidia/nemotron-3-ultra-550b-a55b',
    'anthropic/claude-sonnet-4.5',
    'google/gemini-2.5-pro',
  ])

function isAllowedOpenRouterModel(value: string): value is OpenRouterTextModel {
  return ALLOWED_ENV_MODELS.has(value as OpenRouterTextModel)
}

function resolveEnvModelOverride(): OpenRouterTextModel | null {
  const raw = process.env.OPENROUTER_MODEL?.trim()
  if (!raw) {
    return null
  }
  if (!isAllowedOpenRouterModel(raw)) {
    console.warn(
      `[model-router] Ignoring unrecognized OPENROUTER_MODEL "${raw}". Falling back to tier default.`,
    )
    return null
  }
  return raw
}

function resolveModelId(tier: AiTaskTier): OpenRouterTextModel {
  const mode = process.env.AI_MODE ?? 'free_dev'

  if (mode === 'free_dev') {
    return resolveEnvModelOverride() ?? FREE_DEV_MODELS[tier]
  }

  return PRODUCTION_MODELS[tier]
}

/**
 * Builds OpenRouter provider routing preferences.
 * Note: OpenRouter routing enforces zero data retention / no data collection;
 * regional SG residency requires pinning verified provider slugs via `only`
 * or deploying a dedicated regional endpoint outside `:free` models.
 */
function resolveProviderPreferences(
  strictDataPrivacy: boolean,
): ProviderPreferences | undefined {
  if (!strictDataPrivacy) {
    return undefined
  }
  return {
    dataCollection: 'deny',
    zdr: true,
    allowFallbacks: false,
  }
}

export function getConciergeAdapter(
  tier: AiTaskTier = 'tier2_itinerary_tools',
) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.')
  }
  const modelId = resolveModelId(tier)
  return createOpenRouterText(modelId, apiKey, {
    serverURL:
      process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    httpReferer: process.env.APP_URL ?? 'http://localhost:3000',
    appTitle: process.env.APP_TITLE ?? 'Platform Encounter Sumatra',
  })
}

export function getConciergeModelConfig(
  tier: AiTaskTier = 'tier2_itinerary_tools',
  options: ConciergeModelOptions = {},
) {
  const mode = process.env.AI_MODE ?? 'free_dev'
  const strictDataPrivacy = options.strictDataPrivacy ?? mode !== 'free_dev'
  return {
    adapter: getConciergeAdapter(tier),
    providerPreferences: resolveProviderPreferences(strictDataPrivacy),
  }
}
