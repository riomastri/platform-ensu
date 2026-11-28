import { createOpenRouterText } from '@tanstack/ai-openrouter'

export type AiTaskTier = 'tier1_chat_extract' | 'tier2_itinerary_tools'
export type OpenRouterTextModel = Parameters<typeof createOpenRouterText>[0]

const DEFAULT_FREE_MODEL: OpenRouterTextModel =
  'nvidia/nemotron-3-ultra-550b-a55b:free'

function resolveModelId(
  tier: AiTaskTier,
  strictSgResidency = false,
): OpenRouterTextModel {
  const mode = process.env.AI_MODE ?? 'free_dev'
  let modelId: string = DEFAULT_FREE_MODEL

  if (mode === 'free_dev') {
    modelId = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_FREE_MODEL
  } else if (tier === 'tier1_chat_extract') {
    modelId = DEFAULT_FREE_MODEL
  } else {
    modelId = strictSgResidency
      ? 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
      : DEFAULT_FREE_MODEL
  }
  return modelId as OpenRouterTextModel
}
export function getConciergeAdapter(
  tier: AiTaskTier = 'tier2_itinerary_tools',
  strictSgResidency = false,
) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY belum diatur di file .env.local')
  }
  const modelId = resolveModelId(tier, strictSgResidency)
  return createOpenRouterText(modelId, apiKey, {
    serverURL:
      process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    httpReferer: process.env.APP_URL ?? 'http://localhost:3000',
    appTitle: process.env.APP_TITLE ?? 'Platform Encounter Sumatra',
  })
}
