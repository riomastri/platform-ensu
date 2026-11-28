import { useState } from 'react'
import type { FormEvent } from 'react'

import { AlertCircle, Info, Loader2 } from 'lucide-react'

import { Alert, AlertDescription } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
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

  const authForm = (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {mode === 'sign-up' ? (
        <div className="space-y-2">
          <Label htmlFor="auth-name">Name</Label>
          <Input
            id="auth-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            placeholder="Budi Santoso"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isSubmitting}
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="auth-password">Password</Label>
        <Input
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
        />
      </div>

      {formError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Please wait...
          </>
        ) : mode === 'sign-in' ? (
          'Sign In'
        ) : (
          'Create Account'
        )}
      </Button>
    </form>
  )

  return (
    <section className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader className="space-y-4">
          <Tabs
            value={mode}
            onValueChange={(nextValue) => {
              if (nextValue === 'sign-in' || nextValue === 'sign-up') {
                handleModeChange(nextValue)
              }
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sign-in" disabled={isSubmitting}>
                Sign In
              </TabsTrigger>
              <TabsTrigger value="sign-up" disabled={isSubmitting}>
                Sign Up
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-1">
              <CardTitle>
                {mode === 'sign-in'
                  ? 'Sign in to Encounter Sumatra'
                  : 'Create your account'}
              </CardTitle>
              <CardDescription>
                {mode === 'sign-in'
                  ? 'Sign in to chat with the AI Concierge.'
                  : 'Register an account to access the AI Concierge.'}
              </CardDescription>
            </div>

            {notice ? (
              <Alert role="status" className="mt-4">
                <Info />
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}

            <TabsContent value="sign-in" className="mt-4">
              {mode === 'sign-in' ? authForm : null}
            </TabsContent>
            <TabsContent value="sign-up" className="mt-4">
              {mode === 'sign-up' ? authForm : null}
            </TabsContent>
          </Tabs>
        </CardHeader>
        <CardContent className="sr-only" aria-hidden="true" />
      </Card>
    </section>
  )
}
