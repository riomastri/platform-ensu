import { createFileRoute } from '@tanstack/react-router'
import { getConciergeAdapter } from '@encounter/api/ai'
import {
  chat,
  chatParamsFromRequest,
  toServerSentEventsResponse,
} from '@tanstack/ai'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Read environment variables per request.
        if (!process.env.OPENROUTER_API_KEY) {
          console.error('Missing OPENROUTER_API_KEY')
          return Response.json(
            { error: 'OpenRouter API Key is not configured.' },
            { status: 500 },
          )
        }
        // Parse incoming chat parameters.
        const { messages, threadId, runId } =
          await chatParamsFromRequest(request)
        try {
          // Initialize OpenRouter adapter cia centralized model router.
          const adapter = getConciergeAdapter('tier1_chat_extract')
          // Execute AI chat.
          const stream = chat({
            adapter,
            messages,
            threadId,
            runId,
          })
          // Return SSE response.
          return toServerSentEventsResponse(stream)
        } catch (error) {
          console.error('[POST /api/chat] Error:', error)
          return Response.json(
            { error: 'AI request failed. Check server logs.' },
            { status: 500 },
          )
        }
      },
    },
  },
})
