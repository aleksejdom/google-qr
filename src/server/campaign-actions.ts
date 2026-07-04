'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { sendMail, renderTemplate } from '@/lib/mailer'
import { appUrl } from '@/lib/utils'
import type { ActionState } from '@/server/auth-actions'
import { DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY } from '@/server/templates'

const campaignSchema = z.object({
  name: z.string().min(2, 'Name ist zu kurz'),
  locationId: z.string().optional(),
  channel: z.enum(['EMAIL', 'QR', 'SMS_TEMPLATE', 'WHATSAPP_LINK']),
  emailSubject: z.string().optional(),
  emailBody: z.string().optional(),
})

export async function createCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  const parsed = campaignSchema.safeParse({
    name: formData.get('name'),
    locationId: formData.get('locationId') || undefined,
    channel: formData.get('channel') || 'EMAIL',
    emailSubject: formData.get('emailSubject') || DEFAULT_EMAIL_SUBJECT,
    emailBody: formData.get('emailBody') || DEFAULT_EMAIL_BODY,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const campaign = await prisma.campaign.create({
    data: { ...parsed.data, locationId: parsed.data.locationId || null, orgId: session.orgId },
  })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'campaign.created',
    entity: 'Campaign',
    entityId: campaign.id,
  })
  revalidatePath('/campaigns')
  return { success: 'Kampagne angelegt' }
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const session = await requireSession()
  await prisma.campaign.deleteMany({ where: { id: campaignId, orgId: session.orgId } })
  revalidatePath('/campaigns')
}

/**
 * E-Mail-Kampagne versenden: erstellt fuer jeden Kontakt mit E-Mail (ohne Opt-out,
 * ohne bereits vorhandene Anfrage in dieser Kampagne) eine ReviewRequest und
 * verschickt die E-Mail ueber SMTP.
 */
export async function sendCampaign(campaignId: string): Promise<ActionState> {
  const session = await requireSession()
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, orgId: session.orgId },
    include: { org: true },
  })
  if (!campaign) return { error: 'Kampagne nicht gefunden' }
  if (campaign.channel !== 'EMAIL') return { error: 'Nur E-Mail-Kampagnen koennen versendet werden' }

  const location = campaign.locationId
    ? await prisma.location.findUnique({ where: { id: campaign.locationId } })
    : await prisma.location.findFirst({ where: { orgId: session.orgId } })
  if (!location) return { error: 'Bitte zuerst einen Standort anlegen' }

  const contacts = await prisma.contact.findMany({
    where: {
      orgId: session.orgId,
      optedOutAt: null,
      email: { not: null },
      requests: { none: { campaignId } },
    },
  })

  // Fehlgeschlagene/haengende Anfragen dieser Kampagne erneut versuchen
  const retryRequests = await prisma.reviewRequest.findMany({
    where: {
      campaignId,
      status: { in: ['FAILED', 'PENDING'] },
      contact: { optedOutAt: null, email: { not: null } },
    },
    include: { contact: true },
  })

  if (contacts.length === 0 && retryRequests.length === 0) {
    // Genau erklaeren, warum niemand uebrig bleibt
    const [total, withEmail, optedOut, alreadySent] = await Promise.all([
      prisma.contact.count({ where: { orgId: session.orgId } }),
      prisma.contact.count({ where: { orgId: session.orgId, email: { not: null } } }),
      prisma.contact.count({ where: { orgId: session.orgId, optedOutAt: { not: null } } }),
      prisma.contact.count({
        where: { orgId: session.orgId, requests: { some: { campaignId } } },
      }),
    ])
    if (total === 0) return { error: 'Noch keine Kontakte vorhanden – zuerst unter „Kontakte“ anlegen oder per CSV importieren.' }
    if (withEmail === 0) return { error: `${total} Kontakt(e) vorhanden, aber keiner hat eine E-Mail-Adresse.` }
    if (alreadySent > 0)
      return {
        error: `Alle passenden Kontakte (${alreadySent}) haben aus dieser Kampagne bereits eine Anfrage erhalten. Neue Kontakte anlegen oder eine neue Kampagne erstellen.`,
      }
    if (optedOut > 0) return { error: `Alle Kontakte mit E-Mail haben sich abgemeldet (Opt-out: ${optedOut}).` }
    return { error: 'Keine passenden Kontakte (mit E-Mail, ohne Opt-out) gefunden.' }
  }

  let sent = 0
  let failed = 0
  let lastError: string | undefined

  type SendTarget = {
    requestId: string
    token: string
    contact: { firstName: string; lastName: string | null; email: string | null; optOutToken: string }
  }

  async function deliver(target: SendTarget) {
    const vars = {
      vorname: target.contact.firstName,
      nachname: target.contact.lastName ?? '',
      firma: campaign!.org.name,
      standort: location!.name,
      bewertungslink: appUrl(`/f/${location!.slug}?t=${target.token}`),
      abmeldelink: appUrl(`/opt-out/${target.contact.optOutToken}`),
    }
    const result = await sendMail({
      orgId: session.orgId,
      to: target.contact.email!,
      subject: renderTemplate(campaign!.emailSubject ?? DEFAULT_EMAIL_SUBJECT, vars),
      text: renderTemplate(campaign!.emailBody ?? DEFAULT_EMAIL_BODY, vars),
    })
    await prisma.reviewRequest.update({
      where: { id: target.requestId },
      data: result.ok ? { status: 'SENT', sentAt: new Date() } : { status: 'FAILED' },
    })
    if (result.ok) sent++
    else {
      failed++
      lastError = result.error
    }
  }

  // Neue Kontakte: Anfrage anlegen und versenden
  for (const contact of contacts) {
    const request = await prisma.reviewRequest.create({
      data: {
        orgId: session.orgId,
        campaignId,
        contactId: contact.id,
        locationId: location.id,
        channel: 'EMAIL',
      },
    })
    await deliver({ requestId: request.id, token: request.token, contact })
  }

  // Fehlgeschlagene Anfragen erneut versuchen
  for (const request of retryRequests) {
    await deliver({ requestId: request.id, token: request.token, contact: request.contact })
  }

  if (campaign.status === 'DRAFT') {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE' } })
  }
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'campaign.sent',
    entity: 'Campaign',
    entityId: campaignId,
    meta: { sent, failed },
  })
  revalidatePath(`/campaigns/${campaignId}`)
  revalidatePath('/campaigns')
  return failed > 0
    ? {
        error: `${sent} versendet, ${failed} fehlgeschlagen${lastError ? ` – ${lastError}` : ''}. SMTP unter Einstellungen pruefen.`,
      }
    : { success: `${sent} Bewertungsanfragen versendet` }
}
