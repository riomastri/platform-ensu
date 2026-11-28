import { createFileRoute } from '@tanstack/react-router'
import { Chat } from '../components/Chat'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <main>
      <div className="p-8">
        <h1 className="text-4xl font-bold">
          Welcome to Encounter Sumatra Platform
        </h1>
        <p className="mt-4 text-lg">Get started to develop a great project.</p>
      </div>
      <Chat />
    </main>
  )
}
