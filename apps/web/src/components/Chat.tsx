import { useEffect, useMemo, useRef, useState } from 'react'

import { useChat, fetchServerSentEvents } from '@tanstack/ai-react'
import { useHydrated } from '@tanstack/react-router'

import { authClient } from '#/lib/auth-client'

import { AuthPanel } from './AuthPanel'

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

function createChatFetchClient(
  onHttpError: (status: number, retryAfterSec: number | null) => void,
) {
  return async function chatFetchClient(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const response = await globalThis.fetch(
      input,
      sanitizeChatRequestInit(init),
    )

    if (!response.ok) {
      const retryAfterRaw = response.headers.get('retry-after')
      const parsedRetry = retryAfterRaw ? Number(retryAfterRaw) : NaN
      const retryAfterSec =
        Number.isFinite(parsedRetry) && parsedRetry > 0
          ? Math.ceil(parsedRetry)
          : null
      onHttpError(response.status, retryAfterSec)
    }

    return response
  }
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

function AuthenticatedChat({
  userEmail,
  userName,
  onSessionExpired,
  onSignOut,
}: {
  userEmail: string
  userName: string
  onSessionExpired: () => Promise<void>
  onSignOut: () => Promise<void>
}) {
  const [input, setInput] = useState('')
  const [friendlyError, setFriendlyError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  // TODO(persistence): Saat riwayat chat disimpan di PostgreSQL, terima threadId dari route param / DB milik user yang login dan verifikasi kepemilikannya di server.
  const [threadId] = useState(() => crypto.randomUUID())

  const onSessionExpiredRef = useRef(onSessionExpired)
  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired
  }, [onSessionExpired])

  const connection = useMemo(() => {
    const fetchClient = createChatFetchClient((status, retryAfterSec) => {
      if (status === 401) {
        setFriendlyError(
          'Your session has expired. Please sign in again to continue.',
        )
        void onSessionExpiredRef.current()
        return
      }

      if (status === 429) {
        setFriendlyError(
          retryAfterSec !== null
            ? `Rate limit reached. Please wait ${retryAfterSec} seconds before sending another message.`
            : 'Rate limit reached. Please wait a moment before sending another message.',
        )
        return
      }

      if (status === 503) {
        setFriendlyError(
          'AI service is temporarily unavailable. Please try again shortly.',
        )
        return
      }

      setFriendlyError(null)
    })

    return fetchServerSentEvents('/api/chat', { fetchClient })
  }, [])

  const { messages, sendMessage, isLoading, stop, error } = useChat({
    connection,
    threadId,
  })

  const displayedError = friendlyError ?? error?.message ?? null

  return (
    <section className="mx-auto max-w-3xl space-y-4 p-8">
      <header className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="text-sm text-slate-700">
          Signed in as <span className="font-semibold">{userName}</span>{' '}
          <span className="text-slate-500">({userEmail})</span>
        </div>
        <button
          type="button"
          disabled={isSigningOut}
          onClick={async () => {
            setIsSigningOut(true)
            try {
              await onSignOut()
            } finally {
              setIsSigningOut(false)
            }
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSigningOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </header>

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

      {displayedError ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          {displayedError}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()

          const message = input.trim()

          if (!message || isLoading) {
            return
          }

          setFriendlyError(null)
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

export function Chat() {
  const hydrated = useHydrated()
  const { data: sessionData, isPending, refetch } = authClient.useSession()
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)

  if (!hydrated || isPending) {
    return (
      <section className="mx-auto max-w-3xl p-8">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          Checking session...
        </div>
      </section>
    )
  }

  if (!sessionData) {
    return (
      <AuthPanel
        notice={sessionNotice}
        onAuthenticated={async () => {
          setSessionNotice(null)
          await refetch()
        }}
      />
    )
  }

  return (
    <AuthenticatedChat
      key={sessionData.user.id}
      userEmail={sessionData.user.email}
      userName={sessionData.user.name}
      onSessionExpired={async () => {
        setSessionNotice(
          'Your session has expired. Please sign in again to continue.',
        )
        await refetch()
      }}
      onSignOut={async () => {
        setSessionNotice(null)
        await authClient.signOut()
        await refetch()
      }}
    />
  )
}
