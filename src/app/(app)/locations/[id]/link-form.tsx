'use client'

import { useActionState, useState, useTransition } from 'react'
import { Sparkles } from 'lucide-react'
import { createReviewLink, generateGoogleReviewLink } from '@/server/location-actions'
import type { ActionState } from '@/server/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

export function LinkForm({ locationId }: { locationId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createReviewLink, {})
  const [platform, setPlatform] = useState('GOOGLE')
  const [targetUrl, setTargetUrl] = useState('')
  const [mapsUrl, setMapsUrl] = useState('')
  const [genError, setGenError] = useState<string | null>(null)
  const [genSuccess, setGenSuccess] = useState(false)
  const [generating, startGenerating] = useTransition()

  function handleGenerate() {
    setGenError(null)
    setGenSuccess(false)
    startGenerating(async () => {
      const result = await generateGoogleReviewLink(mapsUrl)
      if (result.url) {
        setTargetUrl(result.url)
        setGenSuccess(true)
      } else {
        setGenError(result.error ?? 'Generierung fehlgeschlagen')
      }
    })
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locationId" value={locationId} />
      <div className="space-y-1.5">
        <Label htmlFor="platform">Plattform</Label>
        <Select
          id="platform"
          name="platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value="GOOGLE">Google</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="TRUSTPILOT">Trustpilot</option>
          <option value="CUSTOM">Andere</option>
        </Select>
      </div>

      {platform === 'GOOGLE' && (
        <div className="space-y-2 rounded-md border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <Label htmlFor="mapsUrl" className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Bewertungslink-Generator
          </Label>
          <p className="text-xs text-zinc-500">
            In Google Maps Ihr Unternehmen oeffnen → „Teilen" → Link kopieren und hier einfuegen.
            Der direkte „Rezension schreiben"-Link wird automatisch erzeugt.
          </p>
          <Input
            id="mapsUrl"
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
            placeholder="https://maps.app.goo.gl/… oder https://www.google.com/maps/place/…"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={generating || !mapsUrl.trim()}
            onClick={handleGenerate}
          >
            {generating ? 'Generiert …' : 'Bewertungslink generieren'}
          </Button>
          {genError && <p className="text-xs text-red-600">{genError}</p>}
          {genSuccess && (
            <p className="text-xs text-emerald-600">
              Bewertungslink erzeugt und unten eingetragen ✓
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="label">Bezeichnung</Label>
        <Input
          id="label"
          name="label"
          required
          placeholder={platform === 'GOOGLE' ? 'Google' : 'Bezeichnung'}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="targetUrl">Bewertungs-URL</Label>
        <Input
          id="targetUrl"
          name="targetUrl"
          type="url"
          required
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder={
            platform === 'GOOGLE'
              ? 'wird vom Generator ausgefuellt …'
              : 'https://…'
          }
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Wird angelegt …' : 'Link anlegen'}
      </Button>
    </form>
  )
}
