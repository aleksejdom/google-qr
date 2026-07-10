'use client'

import { useActionState } from 'react'
import {
  updateOrgName,
  updateSmtpSettings,
  uploadLogo,
  createRecallRule,
} from '@/server/settings-actions'
import type { ActionState } from '@/server/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>
  if (state.success) return <p className="text-sm text-emerald-600">{state.success}</p>
  return null
}

export function OrgNameForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateOrgName, {})
  return (
    <form action={formAction} className="flex items-end gap-3">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="orgname">Name</Label>
        <Input id="orgname" name="name" defaultValue={currentName} required />
      </div>
      <Button type="submit" disabled={pending}>
        Speichern
      </Button>
      <Feedback state={state} />
    </form>
  )
}

export function SmtpForm({
  defaults,
}: {
  defaults: { smtpHost: string; smtpPort: number; smtpUser: string; smtpFrom: string }
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateSmtpSettings, {})
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="smtpHost">Host</Label>
          <Input id="smtpHost" name="smtpHost" defaultValue={defaults.smtpHost} placeholder="smtp.example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtpPort">Port</Label>
          <Input id="smtpPort" name="smtpPort" type="number" defaultValue={defaults.smtpPort} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtpUser">Benutzer</Label>
          <Input id="smtpUser" name="smtpUser" defaultValue={defaults.smtpUser} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="smtpPass">Passwort (leer = unveraendert)</Label>
          <Input id="smtpPass" name="smtpPass" type="password" autoComplete="new-password" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="smtpFrom">Absender</Label>
          <Input id="smtpFrom" name="smtpFrom" defaultValue={defaults.smtpFrom} placeholder="Firma <noreply@firma.de>" />
        </div>
      </div>
      <p className="rounded-md bg-zinc-50 p-3 text-xs text-zinc-500 dark:bg-zinc-900">
        Damit E-Mails nicht im Spam landen: Die Absender-Adresse sollte zur Domain des
        SMTP-Kontos gehoeren, und fuer diese Domain sollten SPF-, DKIM- und DMARC-Eintraege
        gesetzt sein (macht Ihr E-Mail- bzw. Domain-Anbieter). Abmeldelinks und
        One-Click-Abmeldung fuegt ReviewPilot automatisch hinzu.
      </p>
      <Feedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Speichert …' : 'SMTP speichern'}
      </Button>
    </form>
  )
}

export function LogoForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(uploadLogo, {})
  return (
    <form action={formAction} className="flex items-center gap-3">
      <Input name="logo" type="file" accept="image/png,image/jpeg" required className="max-w-xs" />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? 'Laedt hoch …' : 'Logo hochladen'}
      </Button>
      <Feedback state={state} />
    </form>
  )
}

export function RecallRuleForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createRecallRule, {})
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
      <div className="space-y-1.5">
        <Label htmlFor="ruleName">Name</Label>
        <Input id="ruleName" name="name" required placeholder="Standard-Erinnerung" className="w-44" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="daysAfter">Nach Tagen</Label>
        <Input id="daysAfter" name="daysAfter" type="number" defaultValue={3} min={1} className="w-24" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="maxReminders">Max. Erinnerungen</Label>
        <Input id="maxReminders" name="maxReminders" type="number" defaultValue={1} min={1} max={5} className="w-24" />
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        Regel anlegen
      </Button>
      <Feedback state={state} />
    </form>
  )
}
