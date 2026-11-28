import { useEffect, useMemo, useRef, useState } from 'react'

import { useChat, fetchServerSentEvents } from '@tanstack/ai-react'
import { useHydrated } from '@tanstack/react-router'
import {
  AlertCircle,
  Bot,
  ChevronRight,
  LogOut,
  SendHorizontal,
  Sparkles,
  Square,
  User,
} from 'lucide-react'

import { Alert, AlertDescription } from '#/components/ui/alert'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader } from '#/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { authClient } from '#/lib/auth-client'
import { cn } from '#/lib/utils'

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
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-1.5 text-left font-medium text-foreground/80 select-none hover:text-foreground">
        <ChevronRight
          className={cn(
            'size-3.5 transition-transform duration-150',
            isOpen && 'rotate-90',
          )}
        />
        <span>{hasTextAfter ? 'Thought process' : 'Thinking...'}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-muted-foreground">
          {content}
        </pre>
      </CollapsibleContent>
    </Collapsible>
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
    <section className="mx-auto w-full max-w-3xl space-y-4">
      <Card size="sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">
              <Sparkles />
              AI Concierge
            </Badge>
            <span className="text-muted-foreground">
              Signed in as{' '}
              <span className="font-medium text-foreground">{userName}</span> (
              {userEmail})
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSigningOut}
            onClick={async () => {
              setIsSigningOut(true)
              setFriendlyError(null)
              try {
                await onSignOut()
              } catch {
                setFriendlyError(
                  'Unable to sign out. Please check your connection and try again.',
                )
              } finally {
                setIsSigningOut(false)
              }
            }}
          >
            <LogOut />
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              Ask the Encounter Sumatra AI Concierge about destinations, travel
              routes, or local experiences.
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const isUser = message.role === 'user'

                return (
                  <article
                    key={message.id}
                    className={cn(
                      'max-w-[85%] rounded-xl px-4 py-3 text-sm',
                      isUser
                        ? 'ml-auto bg-primary text-primary-foreground'
                        : 'mr-auto border bg-card text-card-foreground',
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Badge
                        variant={isUser ? 'secondary' : 'outline'}
                        className={cn(
                          isUser &&
                            'bg-primary-foreground/15 text-primary-foreground',
                        )}
                      >
                        {isUser ? <User /> : <Bot />}
                        {isUser ? 'You' : 'AI Concierge'}
                      </Badge>
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
                            <p
                              key={index}
                              className="leading-relaxed whitespace-pre-wrap"
                            >
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
          )}

          {displayedError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{displayedError}</AlertDescription>
            </Alert>
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
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask something..."
              disabled={isLoading}
              className="h-9 flex-1"
            />

            {isLoading ? (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                onClick={stop}
              >
                <Square />
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                disabled={!input.trim() || isLoading}
              >
                <SendHorizontal />
                Send
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </section>
  )
}

export function Chat() {
  const hydrated = useHydrated()
  const { data: sessionData, isPending, refetch } = authClient.useSession()
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)

  if (!hydrated || isPending) {
    return (
      <section className="mx-auto w-full max-w-3xl">
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
            <p className="text-sm text-muted-foreground">Checking session...</p>
          </CardContent>
        </Card>
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
        const result = await authClient.signOut()
        if (result.error) {
          throw new Error(result.error.message || 'Unable to sign out.')
        }
        await refetch()
      }}
    />
  )
}
