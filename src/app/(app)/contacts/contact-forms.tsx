'use client'

import { useActionState } from 'react'
import { createContact, importContactsCsv, requestConsent } from '@/server/contact-actions'
import type { ActionState } from '@/server/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MailQuestion } from 'lucide-react'

export function ContactForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createContact, {})

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="firstName">Vorname</Label>
          <Input id="firstName" name="firstName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lastName">Nachname</Label>
          <Input id="lastName" name="lastName" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" name="email" type="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Telefon</Label>
        <Input id="phone" name="phone" />
      </div>
      <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <input type="checkbox" name="consent" className="mt-0.5 accent-zinc-900 dark:accent-zinc-100" />
        <span>
          Einwilligung fuer E-Mail-Anfragen liegt vor (z. B. muendlich oder schriftlich erteilt)
        </span>
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Wird angelegt …' : 'Kontakt anlegen'}
      </Button>
    </form>
  )
}

/** Double-Opt-in: Bestaetigungs-E-Mail an einen Kontakt ausloesen. */
export function RequestConsentButton({ contactId }: { contactId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    () => requestConsent(contactId),
    {}
  )

  return (
    <form action={formAction} className="inline-flex">
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={pending}
        title={
          state.error ??
          state.success ??
          'Einwilligung per Bestaetigungs-E-Mail anfragen (Double-Opt-in)'
        }
      >
        <MailQuestion
          className={`h-4 w-4 ${
            state.error ? 'text-red-500' : state.success ? 'text-emerald-500' : 'text-zinc-400'
          }`}
        />
      </Button>
    </form>
  )
}

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(importContactsCsv, {})

  return (
    <form action={formAction} className="space-y-4">
      <Input name="file" type="file" accept=".csv,text/csv" required />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" variant="secondary" className="w-full" disabled={pending}>
        {pending ? 'Importiert …' : 'CSV importieren'}
      </Button>
    </form>
  )
}
