'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import type { ActionState } from '@/server/auth-actions'
import { CONSENT_TEXT_FUNNEL } from '@/server/templates'

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

const funnelContactSchema = z.object({
  locationSlug: z.string().min(1),
  firstName: z.string().min(1, 'Vorname fehlt'),
  lastName: z.string().optional(),
  email: z.string().email('Ungueltige E-Mail'),
})

export type FunnelContactState = ActionState & { requestToken?: string }

/**
 * Oeffentlich (ohne Login): Besucher legt sich im Bewertungs-Funnel selbst
 * als Kontakt an und kann dabei in E-Mail-Kampagnen einwilligen.
 * Bei erteilter Einwilligung entsteht zusaetzlich eine Bewertungsanfrage
 * (status SENT), damit der Recall-Worker erinnert, falls die Google-Bewertung
 * ausbleibt. Der Klick auf den Bewertungslink setzt sie auf COMPLETED.
 */
export async function submitFunnelContact(
  _prev: FunnelContactState,
  formData: FormData
): Promise<FunnelContactState> {
  const parsed = funnelContactSchema.safeParse({
    locationSlug: formData.get('locationSlug'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName') || undefined,
    email: formData.get('email'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const location = await prisma.location.findUnique({
    where: { slug: parsed.data.locationSlug },
  })
  if (!location) return { error: 'Standort nicht gefunden' }

  const email = parsed.data.email.toLowerCase().trim()
  const hasConsent = formData.get('consent') === 'on'
  const consentData = hasConsent
    ? { consentAt: new Date(), consentText: CONSENT_TEXT_FUNNEL }
    : {}

  const existing = await prisma.contact.findFirst({
    where: { orgId: location.orgId, email },
  })

  let contactId: string
  if (existing) {
    // Kontakt existiert bereits: nur Einwilligung nachtragen. Eine hier aktiv
    // erteilte Einwilligung hebt einen frueheren Opt-out wieder auf.
    if (hasConsent) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: {
          ...(existing.consentConfirmedAt ? {} : consentData),
          optedOutAt: null,
        },
      })
    }
    contactId = existing.id
  } else {
    const contact = await prisma.contact.create({
      data: {
        orgId: location.orgId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName || null,
        email,
        ...consentData,
      },
    })
    contactId = contact.id
  }

  // Mit Einwilligung: offene Bewertungsanfrage anlegen bzw. wiederverwenden,
  // damit Recall-Erinnerungen greifen, wenn keine Bewertung abgegeben wird.
  let requestToken: string | undefined
  if (hasConsent) {
    const openRequest = await prisma.reviewRequest.findFirst({
      where: {
        orgId: location.orgId,
        contactId,
        status: { in: ['PENDING', 'SENT', 'REMINDED'] },
      },
    })
    if (openRequest) {
      requestToken = openRequest.token
    } else {
      const request = await prisma.reviewRequest.create({
        data: {
          orgId: location.orgId,
          contactId,
          locationId: location.id,
          channel: 'EMAIL',
          status: 'SENT',
          sentAt: new Date(),
        },
      })
      requestToken = request.token
    }
  }

  await logAudit({
    orgId: location.orgId,
    action: 'contact.funnel_signup',
    entity: 'Contact',
    entityId: contactId,
    meta: { consent: hasConsent, existing: Boolean(existing) },
  })
  return { success: 'Vielen Dank!', requestToken }
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
