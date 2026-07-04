'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { registerAction, type ActionState } from '@/server/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(registerAction, {})

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Konto erstellen</CardTitle>
        <CardDescription>Organisation und Admin-Zugang anlegen</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="orgName">Firma / Organisation</Label>
            <Input id="orgName" name="orgName" required placeholder="Muster GmbH" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Ihr Name</Label>
            <Input id="name" name="name" required placeholder="Max Mustermann" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-Mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Passwort (min. 8 Zeichen)</Label>
            <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Wird erstellt …' : 'Registrieren'}
          </Button>
          <p className="text-center text-sm text-zinc-500">
            Bereits registriert?{' '}
            <Link href="/login" className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
              Anmelden
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
