import { createFileRoute } from '@tanstack/react-router'
import {
  AiConfigurationError,
  getConciergeModelConfig,
} from '@encounter/api/ai'
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

const aguiTextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(MAX_MESSAGE_CHARS),
})

const legacyTextPartSchema = z.object({
  type: z.literal('text'),
  content: z.string().min(1).max(MAX_MESSAGE_CHARS),
})

const textContentPartSchema = z.union([
  aguiTextPartSchema,
  legacyTextPartSchema,
])

function extractPartTextLength(
  part: z.infer<typeof textContentPartSchema>,
): number {
  return 'text' in part ? part.text.length : part.content.length
}

const userContentArraySchema = z
  .array(textContentPartSchema)
  .min(1)
  .max(10)
  .refine(
    (parts) =>
      parts.reduce((sum, part) => sum + extractPartTextLength(part), 0) <=
      MAX_MESSAGE_CHARS,
    {
      message: `Combined message part length must not exceed ${MAX_MESSAGE_CHARS} characters.`,
    },
  )

const userMessageSchema = z.object({
  role: z.literal('user'),
  content: z.union([
    z.string().min(1).max(MAX_MESSAGE_CHARS),
    userContentArraySchema,
  ]),
})

const assistantMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z.string().max(MAX_MESSAGE_CHARS).optional(),
})

const boundedMessageSchema = z.discriminatedUnion('role', [
  userMessageSchema,
  assistantMessageSchema,
])

const boundedMessagesSchema = z
  .array(boundedMessageSchema)
  .min(1)
  .max(MAX_MESSAGES)

function extractMessageLength(
  content: z.infer<typeof boundedMessageSchema>['content'],
): number {
  if (content === undefined) {
    return 0
  }
  if (typeof content === 'string') {
    return content.length
  }
  return content.reduce((sum, part) => sum + extractPartTextLength(part), 0)
}

class PayloadTooLargeError extends Error {
  constructor() {
    super('Request payload is too large.')
    this.name = 'PayloadTooLargeError'
  }
}

async function readBoundedText(
  request: Request,
  maxBytes: number,
): Promise<string> {
  if (!request.body) {
    return ''
  }

  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let totalBytes = 0

  try {
    for (
      let result = await reader.read();
      !result.done;
      result = await reader.read()
    ) {
      const { value } = result
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new PayloadTooLargeError()
      }
      chunks.push(decoder.decode(value, { stream: true }))
    }
    chunks.push(decoder.decode())
    return chunks.join('')
  } finally {
    reader.releaseLock()
  }
}

async function* withStreamCleanup<T>(
  iterable: AsyncIterable<T>,
  cleanup: () => void,
): AsyncIterable<T> {
  try {
    for await (const chunk of iterable) {
      yield chunk
    }
  } finally {
    cleanup()
  }
}

async function enforceChatAccessGuard(
  _request: Request,
): Promise<Response | null> {
  // Fail-closed outside local development until Better Auth session + Valkey rate limit are wired.
  if (process.env.NODE_ENV !== 'development') {
    console.error(
      '[POST /api/chat] Blocked: auth and rate-limit middleware are not configured for non-development environments.',
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
        const cleanupAbortListener = () => {
          request.signal.removeEventListener('abort', onAbort)
        }

        if (request.signal.aborted) {
          onAbort()
        } else {
          request.signal.addEventListener('abort', onAbort, { once: true })
        }

        try {
          let rawBody: string
          try {
            rawBody = await readBoundedText(request, MAX_REQUEST_BYTES)
          } catch (error) {
            cleanupAbortListener()
            if (error instanceof PayloadTooLargeError) {
              return Response.json(
                { error: 'Request payload is too large.' },
                { status: 413 },
              )
            }
            throw error
          }

          let parsedBody: unknown
          try {
            parsedBody = JSON.parse(rawBody)
          } catch {
            cleanupAbortListener()
            return Response.json(
              { error: 'Invalid JSON request body.' },
              { status: 400 },
            )
          }

          let chatParams: Awaited<ReturnType<typeof chatParamsFromRequestBody>>
          try {
            chatParams = await chatParamsFromRequestBody(parsedBody)
          } catch {
            cleanupAbortListener()
            return Response.json(
              { error: 'Invalid chat request body.' },
              { status: 400 },
            )
          }

          const { messages, threadId, runId } = chatParams
          if (abortController.signal.aborted) {
            cleanupAbortListener()
            return new Response(null, { status: 499 })
          }

          const validatedMessages = boundedMessagesSchema.safeParse(messages)
          if (!validatedMessages.success) {
            cleanupAbortListener()
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
            cleanupAbortListener()
            return Response.json(
              { error: 'Total conversation length exceeds allowed limit.' },
              { status: 400 },
            )
          }

          // Initialize AI adapter and privacy routing preferences via centralized model router.
          const { adapter, providerPreferences } =
            getConciergeModelConfig('tier1_chat_extract')
          // Execute AI chat.
          const stream = withStreamCleanup(
            chat({
              adapter,
              messages,
              threadId,
              runId,
              abortController,
              ...(providerPreferences
                ? { modelOptions: { provider: providerPreferences } }
                : {}),
            }),
            cleanupAbortListener,
          )
          // Return SSE response linked to the same abortController.
          return toServerSentEventsResponse(stream, { abortController })
        } catch (error) {
          cleanupAbortListener()
          console.error('[POST /api/chat] Error:', error)
          if (error instanceof AiConfigurationError) {
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
