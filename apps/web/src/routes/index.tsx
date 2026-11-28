import { createFileRoute } from '@tanstack/react-router'

import { Chat } from '#/components/Chat'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="space-y-2 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome to Encounter Sumatra Platform
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Plan authentic journeys across Sumatra with our AI Concierge.
          </p>
        </header>
        <Chat />
      </div>
    </main>
  )
}
