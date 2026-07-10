'use client'

import { useActionState, useState } from 'react'
import { createCampaign, updateCampaign } from '@/server/campaign-actions'
import type { ActionState } from '@/server/auth-actions'
import { DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY } from '@/server/templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export type CampaignFormData = {
  id: string
  name: string
  locationId: string | null
  emailSubject: string | null
  emailBody: string | null
  bannerLink: string | null
  hasBanner: boolean
}

export function CampaignForm({
  locations,
  orgName,
  campaign,
}: {
  locations: { id: string; name: string }[]
  orgName: string
  /** Wenn gesetzt: bestehende Kampagne bearbeiten statt neu anlegen */
  campaign?: CampaignFormData
}) {
  const isEdit = Boolean(campaign)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateCampaign : createCampaign,
    {}
  )

  // Live-Werte fuer die Vorschau
  const [subject, setSubject] = useState(campaign?.emailSubject ?? DEFAULT_EMAIL_SUBJECT)
  const [body, setBody] = useState(campaign?.emailBody ?? DEFAULT_EMAIL_BODY)
  const [newBannerUrl, setNewBannerUrl] = useState<string | null>(null)
  const [removeBanner, setRemoveBanner] = useState(false)

  const existingBannerUrl = campaign?.hasBanner ? `/api/campaigns/${campaign.id}/banner` : null
  const previewBannerUrl = newBannerUrl ?? (removeBanner ? null : existingBannerUrl)

  return (
    <div className={isEdit ? 'grid gap-6 lg:grid-cols-2' : 'space-y-6'}>
      <form action={formAction} className="space-y-4">
        {campaign && <input type="hidden" name="campaignId" value={campaign.id} />}
        <div className="space-y-1.5">
          <Label htmlFor={`name-${campaign?.id ?? 'new'}`}>Name</Label>
          <Input
            id={`name-${campaign?.id ?? 'new'}`}
            name="name"
            required
            placeholder="Sommer-Aktion"
            defaultValue={campaign?.name}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`locationId-${campaign?.id ?? 'new'}`}>Standort</Label>
          <Select
            id={`locationId-${campaign?.id ?? 'new'}`}
            name="locationId"
            defaultValue={campaign?.locationId ?? ''}
          >
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
          <Label htmlFor={`emailSubject-${campaign?.id ?? 'new'}`}>E-Mail-Betreff</Label>
          <Input
            id={`emailSubject-${campaign?.id ?? 'new'}`}
            name="emailSubject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`emailBody-${campaign?.id ?? 'new'}`}>E-Mail-Text</Label>
          <Textarea
            id={`emailBody-${campaign?.id ?? 'new'}`}
            name="emailBody"
            rows={9}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`banner-${campaign?.id ?? 'new'}`}>
            {campaign?.hasBanner ? 'Banner ersetzen (optional)' : 'Banner (optional)'}
          </Label>
          <Input
            id={`banner-${campaign?.id ?? 'new'}`}
            name="banner"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files?.[0]
              setNewBannerUrl((old) => {
                if (old) URL.revokeObjectURL(old)
                return file ? URL.createObjectURL(file) : null
              })
            }}
          />
          <p className="text-xs text-zinc-400">
            Erscheint oben in der E-Mail, max. 600px breit angezeigt. PNG/JPG/WebP/GIF, max. 2 MB
            – empfohlen 1200×400px.
          </p>
        </div>
        {campaign?.hasBanner && (
          <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              name="removeBanner"
              className="mt-0.5 accent-zinc-900 dark:accent-zinc-100"
              checked={removeBanner}
              onChange={(e) => setRemoveBanner(e.target.checked)}
            />
            <span>Vorhandenen Banner entfernen</span>
          </label>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`bannerLink-${campaign?.id ?? 'new'}`}>Banner-Link (optional)</Label>
          <Input
            id={`bannerLink-${campaign?.id ?? 'new'}`}
            name="bannerLink"
            type="url"
            placeholder="https://ihre-website.de/aktion"
            defaultValue={campaign?.bannerLink ?? ''}
          />
          <p className="text-xs text-zinc-400">Klick auf den Banner oeffnet diese Seite.</p>
        </div>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending
            ? isEdit
              ? 'Speichert …'
              : 'Wird angelegt …'
            : isEdit
              ? 'Aenderungen speichern'
              : 'Kampagne anlegen'}
        </Button>
      </form>

      <EmailPreview subject={subject} body={body} bannerUrl={previewBannerUrl} orgName={orgName} />
    </div>
  )
}

const PREVIEW_VARS: Record<string, string> = {
  vorname: 'Max',
  nachname: 'Mustermann',
  standort: 'Hauptstandort',
  bewertungslink: 'https://ihre-domain.de/f/standort?t=beispiel',
  abmeldelink: 'https://ihre-domain.de/opt-out/beispiel',
}

/** Platzhalter mit Beispieldaten ersetzen (Client-Pendant zu renderTemplate). */
function fillTemplate(template: string, orgName: string): string {
  const vars: Record<string, string> = { ...PREVIEW_VARS, firma: orgName }
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

/** Live-Vorschau der E-Mail, wie sie beim Empfaenger ungefaehr aussieht. */
function EmailPreview({
  subject,
  body,
  bannerUrl,
  orgName,
}: {
  subject: string
  body: string
  bannerUrl: string | null
  orgName: string
}) {
  // URLs im Text wie im E-Mail-HTML als Links darstellen
  const parts = fillTemplate(body, orgName).split(/(https?:\/\/[^\s]+)/g)

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Vorschau – Platzhalter mit Beispieldaten
        </p>
        <p className="mt-1 truncate text-sm font-medium">
          <span className="text-zinc-400">Betreff:</span> {fillTemplate(subject, orgName)}
        </p>
      </div>
      <div className="bg-zinc-100 p-4 dark:bg-zinc-950">
        <div className="mx-auto max-w-[600px] space-y-4 rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
          {bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bannerUrl}
              alt="Banner-Vorschau"
              className="block w-full rounded-lg border-0"
            />
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {parts.map((part, i) =>
              /^https?:\/\//.test(part) ? (
                <span key={i} className="break-all text-blue-600 underline">
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
