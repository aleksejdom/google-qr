'use client'

import { useActionState } from 'react'
import { createLocation } from '@/server/location-actions'
import type { ActionState } from '@/server/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

export function LocationForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createLocation, {})

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="Filiale Innenstadt" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address">Adresse (optional)</Label>
        <Input id="address" name="address" placeholder="Musterstr. 1, 12345 Berlin" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="feedbackThreshold">Ab wie vielen Sternen extern bewerten?</Label>
        <Select id="feedbackThreshold" name="feedbackThreshold" defaultValue="4">
          <option value="3">ab 3 Sternen</option>
          <option value="4">ab 4 Sternen</option>
          <option value="5">nur bei 5 Sternen</option>
        </Select>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Wird angelegt …' : 'Standort anlegen'}
      </Button>
    </form>
  )
}
