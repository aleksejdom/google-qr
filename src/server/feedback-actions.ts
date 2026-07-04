'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import type { ActionState } from '@/server/auth-actions'

const feedbackSchema = z.object({
  locationSlug: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(4000).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  requestToken: z.string().optional(),
})

/** Oeffentliches internes Feedback (ohne Login). Erst ab hier entsteht ein Task. */
export async function submitFeedback(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = feedbackSchema.safeParse({
    locationSlug: formData.get('locationSlug'),
    rating: formData.get('rating'),
    comment: formData.get('comment') || undefined,
    contactEmail: formData.get('contactEmail') || '',
    requestToken: formData.get('requestToken') || undefined,
  })
  if (!parsed.success) return { error: 'Bitte Bewertung auswaehlen' }

  const location = await prisma.location.findUnique({
    where: { slug: parsed.data.locationSlug },
  })
  if (!location) return { error: 'Standort nicht gefunden' }

  let requestId: string | undefined
  if (parsed.data.requestToken) {
    const request = await prisma.reviewRequest.findUnique({
      where: { token: parsed.data.requestToken },
      include: { feedback: true },
    })
    if (request && request.orgId === location.orgId && !request.feedback) {
      requestId = request.id
      await prisma.reviewRequest.update({
        where: { id: request.id },
        data: { status: 'COMPLETED' },
      })
    }
  }

  const feedback = await prisma.feedbackEntry.create({
    data: {
      orgId: location.orgId,
      locationId: location.id,
      requestId,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      contactEmail: parsed.data.contactEmail || null,
    },
  })

  // Negatives Feedback erzeugt automatisch eine Aufgabe
  if (parsed.data.rating < location.feedbackThreshold) {
    await prisma.task.create({
      data: {
        orgId: location.orgId,
        title: `Negatives Feedback (${parsed.data.rating}★) – ${location.name}`,
        description: parsed.data.comment || 'Kein Kommentar hinterlassen.',
        feedbackId: feedback.id,
      },
    })
  }

  await logAudit({
    orgId: location.orgId,
    action: 'feedback.submitted',
    entity: 'FeedbackEntry',
    entityId: feedback.id,
    meta: { rating: parsed.data.rating },
  })
  return { success: 'Vielen Dank fuer Ihr Feedback!' }
}

/** Klick auf externen Bewertungslink im Funnel als abgeschlossen markieren. */
export async function markRequestCompleted(requestToken: string): Promise<void> {
  const request = await prisma.reviewRequest.findUnique({ where: { token: requestToken } })
  if (request && request.status !== 'COMPLETED') {
    await prisma.reviewRequest.update({
      where: { id: request.id },
      data: { status: 'COMPLETED' },
    })
  }
}

export async function updateTaskStatus(taskId: string, status: 'OPEN' | 'IN_PROGRESS' | 'DONE'): Promise<void> {
  const session = await requireSession()
  await prisma.task.updateMany({
    where: { id: taskId, orgId: session.orgId },
    data: { status },
  })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'task.status_changed',
    entity: 'Task',
    entityId: taskId,
    meta: { status },
  })
  revalidatePath('/tasks')
}

const taskSchema = z.object({
  title: z.string().min(2, 'Titel ist zu kurz'),
  description: z.string().optional(),
})

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  const parsed = taskSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  await prisma.task.create({
    data: { ...parsed.data, orgId: session.orgId },
  })
  revalidatePath('/tasks')
  return { success: 'Aufgabe angelegt' }
}
