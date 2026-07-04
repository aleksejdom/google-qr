'use client'

import { useActionState } from 'react'
import { createReviewLink } from '@/server/location-actions'
import type { ActionState } from '@/server/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

export function LinkForm({ locationId }: { locationId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createReviewLink, {})

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locationId" value={locationId} />
      <div className="space-y-1.5">
        <Label htmlFor="platform">Plattform</Label>
        <Select id="platform" name="platform" defaultValue="GOOGLE">
          <option value="GOOGLE">Google</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="TRUSTPILOT">Trustpilot</option>
          <option value="CUSTOM">Andere</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="label">Bezeichnung</Label>
        <Input id="label" name="label" required placeholder="Google" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="targetUrl">Bewertungs-URL</Label>
        <Input
          id="targetUrl"
          name="targetUrl"
          type="url"
          required
          placeholder="https://g.page/r/…/review"
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
