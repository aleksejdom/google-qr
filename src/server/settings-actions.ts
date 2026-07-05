'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession, assertAdmin } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { saveFile } from '@/lib/storage'
import type { ActionState } from '@/server/auth-actions'

const smtpSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().optional(),
})

export async function updateSmtpSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  assertAdmin(session)
  const parsed = smtpSchema.safeParse({
    smtpHost: formData.get('smtpHost') || undefined,
    smtpPort: formData.get('smtpPort') || undefined,
    smtpUser: formData.get('smtpUser') || undefined,
    smtpPass: formData.get('smtpPass') || undefined,
    smtpFrom: formData.get('smtpFrom') || undefined,
  })
  if (!parsed.success) return { error: 'SMTP-Einstellungen pruefen' }

  await prisma.organization.update({
    where: { id: session.orgId },
    data: {
      smtpHost: parsed.data.smtpHost?.trim() || null,
      smtpPort: parsed.data.smtpPort ?? null,
      smtpUser: parsed.data.smtpUser?.trim() || null,
      // Leeres Passwort-Feld bedeutet: bestehendes Passwort behalten
      ...(parsed.data.smtpPass?.trim() ? { smtpPass: parsed.data.smtpPass.trim() } : {}),
      smtpFrom: parsed.data.smtpFrom?.trim() || null,
    },
  })
  await logAudit({ orgId: session.orgId, userId: session.userId, action: 'org.smtp_updated' })
  revalidatePath('/settings')
  return { success: 'SMTP-Einstellungen gespeichert' }
}

export async function updateOrgName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  assertAdmin(session)
  const name = String(formData.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Name ist zu kurz' }
  await prisma.organization.update({ where: { id: session.orgId }, data: { name } })
  await logAudit({ orgId: session.orgId, userId: session.userId, action: 'org.renamed' })
  revalidatePath('/settings')
  return { success: 'Gespeichert' }
}

/** Logo-Upload (PNG/JPG) – landet im MinIO-Bucket bzw. lokalen Storage. */
export async function uploadLogo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  assertAdmin(session)
  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) return { error: 'Keine Datei ausgewaehlt' }
  if (file.size > 2 * 1024 * 1024) return { error: 'Logo ist groesser als 2 MB' }
  if (!['image/png', 'image/jpeg'].includes(file.type)) return { error: 'Nur PNG oder JPG erlaubt' }

  const buffer = Buffer.from(await file.arrayBuffer())
  await saveFile(`logos/${session.orgId}.png`, buffer, file.type)
  await logAudit({ orgId: session.orgId, userId: session.userId, action: 'org.logo_uploaded' })
  revalidatePath('/settings')
  return { success: 'Logo gespeichert – wird ab jetzt in QR-Codes eingebettet' }
}

const recallSchema = z.object({
  name: z.string().min(2, 'Name ist zu kurz'),
  daysAfter: z.coerce.number().int().min(1).max(365),
  maxReminders: z.coerce.number().int().min(1).max(5),
})

export async function createRecallRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  assertAdmin(session)
  const parsed = recallSchema.safeParse({
    name: formData.get('name'),
    daysAfter: formData.get('daysAfter'),
    maxReminders: formData.get('maxReminders'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  await prisma.recallRule.create({ data: { ...parsed.data, orgId: session.orgId } })
  await logAudit({ orgId: session.orgId, userId: session.userId, action: 'recall.rule_created' })
  revalidatePath('/settings')
  return { success: 'Recall-Regel angelegt' }
}

export async function toggleRecallRule(ruleId: string): Promise<void> {
  const session = await requireSession()
  assertAdmin(session)
  const rule = await prisma.recallRule.findFirst({ where: { id: ruleId, orgId: session.orgId } })
  if (!rule) return
  await prisma.recallRule.update({ where: { id: ruleId }, data: { active: !rule.active } })
  revalidatePath('/settings')
}

export async function deleteRecallRule(ruleId: string): Promise<void> {
  const session = await requireSession()
  assertAdmin(session)
  await prisma.recallRule.deleteMany({ where: { id: ruleId, orgId: session.orgId } })
  revalidatePath('/settings')
}
