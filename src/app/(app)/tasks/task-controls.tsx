'use client'

import { useActionState, useTransition } from 'react'
import { createTask, updateTaskStatus } from '@/server/feedback-actions'
import type { ActionState } from '@/server/auth-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function TaskForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTask, {})

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Titel</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Beschreibung</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Wird angelegt …' : 'Aufgabe anlegen'}
      </Button>
    </form>
  )
}

export function TaskStatusButtons({
  taskId,
  current,
}: {
  taskId: string
  current: string
}) {
  const [pending, startTransition] = useTransition()
  const next: { status: 'OPEN' | 'IN_PROGRESS' | 'DONE'; label: string }[] = [
    { status: 'IN_PROGRESS', label: 'In Arbeit' },
    { status: 'DONE', label: 'Erledigt' },
    { status: 'OPEN', label: 'Wieder oeffnen' },
  ]

  return (
    <div className="flex gap-1">
      {next
        .filter((n) => n.status !== current)
        .map((n) => (
          <Button
            key={n.status}
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => updateTaskStatus(taskId, n.status))}
          >
            {n.label}
          </Button>
        ))}
    </div>
  )
}
