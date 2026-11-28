import { useEffect, useRef, useState } from 'react'

import { useChat, fetchServerSentEvents } from '@tanstack/ai-react'

function sanitizeChatRequestInit(init?: RequestInit): RequestInit | undefined {
  if (typeof init?.body !== 'string') {
    return init
  }

  try {
    const parsed: unknown = JSON.parse(init.body)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      'messages' in parsed &&
      Array.isArray(parsed.messages)
    ) {
      const sanitizedMessages = parsed.messages.filter(
        (message: unknown) =>
          !(
            typeof message === 'object' &&
            message !== null &&
            'role' in message &&
            message.role === 'reasoning'
          ),
      )

      return {
        ...init,
        body: JSON.stringify({
          ...parsed,
          messages: sanitizedMessages,
        }),
      }
    }
  } catch {
    return init
  }

  return init
}

function chatFetchClient(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return globalThis.fetch(input, sanitizeChatRequestInit(init))
}

function ThinkingPart({
  content,
  hasTextAfter,
}: {
  content: string
  hasTextAfter: boolean
}) {
  const [isOpen, setIsOpen] = useState(!hasTextAfter)
  const prevHasTextAfterRef = useRef(hasTextAfter)

  useEffect(() => {
    if (!prevHasTextAfterRef.current && hasTextAfter) {
      setIsOpen(false)
    }
    prevHasTextAfterRef.current = hasTextAfter
  }, [hasTextAfter])

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="rounded border border-slate-200 bg-white/80 p-2 text-xs text-slate-600"
    >
      <summary className="cursor-pointer font-medium select-none">
        {hasTextAfter ? 'Thought process' : 'Thinking...'}
      </summary>
      <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed">
        {content}
      </pre>
    </details>
  )
}

export function Chat() {
  const [input, setInput] = useState('')
  // TODO(persistence): Saat riwayat chat disimpan di PostgreSQL, terima threadId dari route param / DB milik user yang login dan verifikasi kepemilikannya di server.
  const [threadId] = useState(() => crypto.randomUUID())

  const { messages, sendMessage, isLoading, stop, error } = useChat({
    connection: fetchServerSentEvents('/api/chat', {
      fetchClient: chatFetchClient,
    }),
    threadId,
  })

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-8">
      <div className="space-y-3">
        {messages.map((message) => {
          const isUser = message.role === 'user'

          return (
            <article
              key={message.id}
              className={
                isUser
                  ? 'ml-auto max-w-[85%] rounded-lg bg-slate-900 p-3 text-white'
                  : 'mr-auto max-w-[85%] rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-900'
              }
            >
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
                {isUser ? 'You' : 'AI Concierge'}
              </div>

              <div className="space-y-2">
                {message.parts.map((part, index) => {
                  if (part.type === 'thinking') {
                    const hasTextAfter = message.parts
                      .slice(index + 1)
                      .some((nextPart) => nextPart.type === 'text')

                    return (
                      <ThinkingPart
                        key={index}
                        content={part.content}
                        hasTextAfter={hasTextAfter}
                      />
                    )
                  }

                  if (part.type === 'text' && part.content) {
                    return (
                      <p key={index} className="whitespace-pre-wrap">
                        {part.content}
                      </p>
                    )
                  }

                  return null
                })}
              </div>
            </article>
          )
        })}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error.message}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()

          const message = input.trim()

          if (!message || isLoading) {
            return
          }

          sendMessage(message)
          setInput('')
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask something..."
          disabled={isLoading}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2"
        />

        {isLoading ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-md bg-red-600 px-4 py-2 text-white"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        )}
      </form>
    </section>
  )
}
