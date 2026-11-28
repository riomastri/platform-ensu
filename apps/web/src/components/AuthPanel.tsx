import { useState } from 'react'
import type { FormEvent } from 'react'

import { authClient } from '#/lib/auth-client'

type AuthMode = 'sign-in' | 'sign-up'

export function AuthPanel({
  notice,
  onAuthenticated,
}: {
  notice?: string | null
  onAuthenticated: () => Promise<void> | void
}) {
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode)
    setFormError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedEmail = email.trim()
    const trimmedName = name.trim()

    if (!trimmedEmail) {
      setFormError('Email is required.')
      return
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }

    if (mode === 'sign-up' && !trimmedName) {
      setFormError('Full name is required to create an account.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'sign-up') {
        const result = await authClient.signUp.email({
          name: trimmedName,
          email: trimmedEmail,
          password,
        })
        if (result.error) {
          setFormError(
            result.error.message || 'Unable to create account. Try again.',
          )
          return
        }
      } else {
        const result = await authClient.signIn.email({
          email: trimmedEmail,
          password,
        })
        if (result.error) {
          setFormError(result.error.message || 'Invalid email or password.')
          return
        }
      }

      await onAuthenticated()
    } catch {
      setFormError(
        'Network error while authenticating. Please check your connection.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-md p-8">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => handleModeChange('sign-in')}
            disabled={isSubmitting}
            className={
              mode === 'sign-in'
                ? 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100'
            }
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('sign-up')}
            disabled={isSubmitting}
            className={
              mode === 'sign-up'
                ? 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white'
                : 'rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100'
            }
          >
            Sign Up
          </button>
        </div>

        <h2 className="mb-1 text-lg font-semibold text-slate-900">
          {mode === 'sign-in'
            ? 'Sign in to Encounter Sumatra'
            : 'Create your account'}
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          {mode === 'sign-in'
            ? 'Sign in to chat with the AI Concierge.'
            : 'Register an account to access the AI Concierge.'}
        </p>

        {notice ? (
          <p
            role="status"
            className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800"
          >
            {notice}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {mode === 'sign-up' ? (
            <div>
              <label
                htmlFor="auth-name"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Name
              </label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSubmitting}
                placeholder="Budi Santoso"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="auth-email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              placeholder="you@example.com"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={
                mode === 'sign-up' ? 'new-password' : 'current-password'
              }
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              placeholder="Minimum 8 characters"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {formError ? (
            <p
              role="alert"
              className="rounded-md bg-red-50 p-2.5 text-sm text-red-700"
            >
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? 'Please wait...'
              : mode === 'sign-in'
                ? 'Sign In'
                : 'Create Account'}
          </button>
        </form>
      </div>
    </section>
  )
}
