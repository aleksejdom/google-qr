'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { loginAction, type ActionState } from '@/server/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, {})
  const registered = useSearchParams().get('registered')

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">ReviewPilot</CardTitle>
        <CardDescription>Mit E-Mail und Passwort anmelden</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {registered && (
            <p className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Registrierung erfolgreich – bitte anmelden.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Passwort</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Anmelden …' : 'Anmelden'}
          </Button>
          <p className="text-center text-sm text-zinc-500">
            Noch kein Konto?{' '}
            <Link href="/register" className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
              Registrieren
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
