'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { randomCode, slugify } from '@/lib/utils'
import type { ActionState } from '@/server/auth-actions'

const locationSchema = z.object({
  name: z.string().min(2, 'Name ist zu kurz'),
  address: z.string().optional(),
  feedbackThreshold: z.coerce.number().int().min(1).max(5).default(4),
})

export async function createLocation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  const parsed = locationSchema.safeParse({
    name: formData.get('name'),
    address: formData.get('address') || undefined,
    feedbackThreshold: formData.get('feedbackThreshold') || 4,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  let slug = slugify(parsed.data.name) || 'standort'
  if (await prisma.location.findUnique({ where: { slug } })) {
    slug = `${slug}-${randomCode(4).toLowerCase()}`
  }

  const location = await prisma.location.create({
    data: { ...parsed.data, slug, orgId: session.orgId },
  })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'location.created',
    entity: 'Location',
    entityId: location.id,
  })
  revalidatePath('/locations')
  return { success: 'Standort angelegt' }
}

export async function deleteLocation(locationId: string): Promise<void> {
  const session = await requireSession()
  await prisma.location.deleteMany({ where: { id: locationId, orgId: session.orgId } })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'location.deleted',
    entity: 'Location',
    entityId: locationId,
  })
  revalidatePath('/locations')
}

const linkSchema = z.object({
  locationId: z.string().min(1),
  platform: z.enum(['GOOGLE', 'FACEBOOK', 'TRUSTPILOT', 'CUSTOM']),
  label: z.string().min(1, 'Bezeichnung fehlt'),
  targetUrl: z.string().url('Ungueltige URL'),
})

export async function createReviewLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  const parsed = linkSchema.safeParse({
    locationId: formData.get('locationId'),
    platform: formData.get('platform'),
    label: formData.get('label'),
    targetUrl: formData.get('targetUrl'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  // Standort muss zur Organisation gehoeren
  const location = await prisma.location.findFirst({
    where: { id: parsed.data.locationId, orgId: session.orgId },
  })
  if (!location) return { error: 'Standort nicht gefunden' }

  const link = await prisma.reviewLink.create({
    data: { ...parsed.data, code: randomCode() },
  })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'reviewlink.created',
    entity: 'ReviewLink',
    entityId: link.id,
  })
  revalidatePath(`/locations/${location.id}`)
  return { success: 'Bewertungslink angelegt' }
}

export async function deleteReviewLink(linkId: string): Promise<void> {
  const session = await requireSession()
  const link = await prisma.reviewLink.findFirst({
    where: { id: linkId, location: { orgId: session.orgId } },
  })
  if (!link) return
  await prisma.reviewLink.delete({ where: { id: linkId } })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'reviewlink.deleted',
    entity: 'ReviewLink',
    entityId: linkId,
  })
  revalidatePath(`/locations/${link.locationId}`)
}
