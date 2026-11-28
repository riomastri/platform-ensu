import { createFileRoute } from '@tanstack/react-router'
import { getConciergeAdapter } from '@encounter/api/ai'
import {
  chat,
  chatParamsFromRequestBody,
  toServerSentEventsResponse,
} from '@tanstack/ai'
import { z } from 'zod'

const MAX_REQUEST_BYTES = 64 * 1024
const MAX_MESSAGES = 30
const MAX_MESSAGE_CHARS = 4000
const MAX_TOTAL_CHARS = 24000

const textContentPartSchema = z.object({
  type: z.literal('text'),
  content: z.string().min(1).max(MAX_MESSAGE_CHARS),
})

const boundedMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([
    z.string().min(1).max(MAX_MESSAGE_CHARS),
    z.array(textContentPartSchema).min(1).max(10),
  ]),
})

const boundedMessagesSchema = z
  .array(boundedMessageSchema)
  .min(1)
  .max(MAX_MESSAGES)

function extractMessageLength(
  content: z.infer<typeof boundedMessageSchema>['content'],
): number {
  if (typeof content === 'string') {
    return content.length
  }
  return content.reduce((sum, part) => sum + part.content.length, 0)
}

async function enforceChatAccessGuard(
  _request: Request,
): Promise<Response | null> {
  // Fail-closed outside local development until Better Auth session + Valkey rate limit are wired.
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[POST /api/chat] Blocked: auth and rate-limit middleware are not configured for production.',
    )
    return Response.json(
      { error: 'Chat endpoint is not enabled in this environment.' },
      { status: 503 },
    )
  }
  return null
}

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const guardResponse = await enforceChatAccessGuard(request)
        if (guardResponse) {
          return guardResponse
        }

        const contentLengthHeader = request.headers.get('content-length')
        if (
          contentLengthHeader &&
          Number(contentLengthHeader) > MAX_REQUEST_BYTES
        ) {
          return Response.json(
            { error: 'Request payload is too large.' },
            { status: 413 },
          )
        }

        const abortController = new AbortController()
        const onAbort = () => {
          abortController.abort(request.signal.reason)
        }

        if (request.signal.aborted) {
          onAbort()
        } else {
          request.signal.addEventListener('abort', onAbort, { once: true })
        }

        try {
          const rawBody = await request.text()
          if (
            new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES
          ) {
            request.signal.removeEventListener('abort', onAbort)
            return Response.json(
              { error: 'Request payload is too large.' },
              { status: 413 },
            )
          }

          let parsedBody: unknown
          try {
            parsedBody = JSON.parse(rawBody)
          } catch {
            request.signal.removeEventListener('abort', onAbort)
            return Response.json(
              { error: 'Invalid JSON request body.' },
              { status: 400 },
            )
          }

          let chatParams: Awaited<ReturnType<typeof chatParamsFromRequestBody>>
          try {
            chatParams = await chatParamsFromRequestBody(parsedBody)
          } catch {
            request.signal.removeEventListener('abort', onAbort)
            return Response.json(
              { error: 'Invalid chat request body.' },
              { status: 400 },
            )
          }

          const { messages, threadId, runId } = chatParams
          if (abortController.signal.aborted) {
            return new Response(null, { status: 499 })
          }

          const validatedMessages = boundedMessagesSchema.safeParse(messages)
          if (!validatedMessages.success) {
            request.signal.removeEventListener('abort', onAbort)
            return Response.json(
              { error: 'Chat messages exceed allowed bounds or format.' },
              { status: 400 },
            )
          }

          const totalChars = validatedMessages.data.reduce(
            (sum, msg) => sum + extractMessageLength(msg.content),
            0,
          )
          if (totalChars > MAX_TOTAL_CHARS) {
            request.signal.removeEventListener('abort', onAbort)
            return Response.json(
              { error: 'Total conversation length exceeds allowed limit.' },
              { status: 400 },
            )
          }

          // Initialize AI adapter via centralized model router (validates server config).
          const adapter = getConciergeAdapter('tier1_chat_extract')
          // Execute AI chat.
          const stream = chat({
            adapter,
            messages,
            threadId,
            runId,
            abortController,
          })
          // Return SSE response linked to the same abortController.
          return toServerSentEventsResponse(stream, { abortController })
        } catch (error) {
          request.signal.removeEventListener('abort', onAbort)
          console.error('[POST /api/chat] Error:', error)
          if (
            error instanceof Error &&
            error.message.includes('OPENROUTER_API_KEY')
          ) {
            return Response.json(
              { error: 'AI service is temporarily unavailable.' },
              { status: 503 },
            )
          }
          return Response.json(
            { error: 'Unable to process chat request.' },
            { status: 500 },
          )
        }
      },
    },
  },
})
