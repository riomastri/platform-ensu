import { useState } from 'react'

import { useChat, fetchServerSentEvents } from '@tanstack/ai-react'

export function Chat() {
  const [input, setInput] = useState('')

  const { messages, sendMessage, isLoading, stop, error } = useChat({
    connection: fetchServerSentEvents('/api/chat'),
    threadId: 'ensu-development-chat',
  })
  return (
    <section>
      <div>
        {messages.map((message) => (
          <div key={message.id}>
            {message.parts.map((part, index) =>
              part.type === 'text' ? <p key={index}>{part.content}</p> : null,
            )}
          </div>
        ))}
      </div>
      {error ? <p role="alert">{error.message}</p> : null}
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
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask something..."
          disabled={isLoading}
        />

        {isLoading ? (
          <button type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="submit">Send</button>
        )}
      </form>
    </section>
  )
}
