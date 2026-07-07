'use client'

import { useActionState } from 'react'
import { createCampaign } from '@/server/campaign-actions'
import type { ActionState } from '@/server/auth-actions'
import { DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY } from '@/server/templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export function CampaignForm({ locations }: { locations: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createCampaign, {})

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="Sommer-Aktion" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="locationId">Standort</Label>
        <Select id="locationId" name="locationId" defaultValue="">
          <option value="">Erster Standort (Standard)</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
      <input type="hidden" name="channel" value="EMAIL" />
      <div className="space-y-1.5">
        <Label htmlFor="emailSubject">E-Mail-Betreff</Label>
        <Input id="emailSubject" name="emailSubject" defaultValue={DEFAULT_EMAIL_SUBJECT} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="emailBody">E-Mail-Text</Label>
        <Textarea id="emailBody" name="emailBody" rows={9} defaultValue={DEFAULT_EMAIL_BODY} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="banner">Banner (optional)</Label>
        <Input id="banner" name="banner" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
        <p className="text-xs text-zinc-400">
          Erscheint oben in der E-Mail, max. 600px breit angezeigt. PNG/JPG/WebP/GIF, max. 2 MB
          – empfohlen 1200×400px.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bannerLink">Banner-Link (optional)</Label>
        <Input id="bannerLink" name="bannerLink" type="url" placeholder="https://ihre-website.de/aktion" />
        <p className="text-xs text-zinc-400">Klick auf den Banner oeffnet diese Seite.</p>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Wird angelegt …' : 'Kampagne anlegen'}
      </Button>
    </form>
  )
}
