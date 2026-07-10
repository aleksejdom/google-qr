'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { createMailer, renderTemplate, renderEmailHtml } from '@/lib/mailer'
import { saveFile, deleteFile } from '@/lib/storage'
import { appUrl } from '@/lib/utils'
import type { ActionState } from '@/server/auth-actions'
import { DEFAULT_EMAIL_SUBJECT, DEFAULT_EMAIL_BODY } from '@/server/templates'

const campaignSchema = z.object({
  name: z.string().min(2, 'Name ist zu kurz'),
  locationId: z.string().optional(),
  channel: z.enum(['EMAIL', 'QR', 'SMS_TEMPLATE', 'WHATSAPP_LINK']),
  emailSubject: z.string().optional(),
  emailBody: z.string().optional(),
  bannerLink: z.string().url('Banner-Link ist keine gueltige URL').optional().or(z.literal('')),
})

const BANNER_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

export async function createCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  const parsed = campaignSchema.safeParse({
    name: formData.get('name'),
    locationId: formData.get('locationId') || undefined,
    channel: formData.get('channel') || 'EMAIL',
    emailSubject: formData.get('emailSubject') || DEFAULT_EMAIL_SUBJECT,
    emailBody: formData.get('emailBody') || DEFAULT_EMAIL_BODY,
    bannerLink: formData.get('bannerLink') || '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  // Optionaler Banner (wird in der E-Mail mit max. 600px Breite angezeigt)
  const banner = formData.get('banner')
  let bannerType: string | null = null
  if (banner instanceof File && banner.size > 0) {
    if (banner.size > 2 * 1024 * 1024) return { error: 'Banner ist groesser als 2 MB' }
    if (!BANNER_TYPES.includes(banner.type)) return { error: 'Banner: nur PNG, JPG, WebP oder GIF' }
    bannerType = banner.type
  }

  const { bannerLink, ...campaignData } = parsed.data
  const campaign = await prisma.campaign.create({
    data: {
      ...campaignData,
      locationId: parsed.data.locationId || null,
      orgId: session.orgId,
      bannerType,
      bannerLink: bannerType ? bannerLink || null : null,
    },
  })
  if (bannerType && banner instanceof File) {
    const buffer = Buffer.from(await banner.arrayBuffer())
    await saveFile(`banners/${campaign.id}`, buffer, bannerType)
  }
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

/** Bestehende Kampagne bearbeiten (Name, Standort, Texte, Banner). */
export async function updateCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  const campaignId = String(formData.get('campaignId') ?? '')
  const existing = await prisma.campaign.findFirst({
    where: { id: campaignId, orgId: session.orgId },
  })
  if (!existing) return { error: 'Kampagne nicht gefunden' }

  const parsed = campaignSchema.safeParse({
    name: formData.get('name'),
    locationId: formData.get('locationId') || undefined,
    channel: formData.get('channel') || existing.channel,
    emailSubject: formData.get('emailSubject') || DEFAULT_EMAIL_SUBJECT,
    emailBody: formData.get('emailBody') || DEFAULT_EMAIL_BODY,
    bannerLink: formData.get('bannerLink') || '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const banner = formData.get('banner')
  const hasNewBanner = banner instanceof File && banner.size > 0
  if (hasNewBanner) {
    if (banner.size > 2 * 1024 * 1024) return { error: 'Banner ist groesser als 2 MB' }
    if (!BANNER_TYPES.includes(banner.type)) return { error: 'Banner: nur PNG, JPG, WebP oder GIF' }
  }
  const removeBanner = formData.get('removeBanner') === 'on' && !hasNewBanner

  const bannerType = hasNewBanner ? banner.type : removeBanner ? null : existing.bannerType
  const { bannerLink, ...campaignData } = parsed.data
  await prisma.campaign.update({
    where: { id: existing.id },
    data: {
      ...campaignData,
      locationId: parsed.data.locationId || null,
      bannerType,
      bannerLink: bannerType ? bannerLink || null : null,
    },
  })
  if (hasNewBanner) {
    const buffer = Buffer.from(await banner.arrayBuffer())
    await saveFile(`banners/${existing.id}`, buffer, banner.type)
  } else if (removeBanner && existing.bannerType) {
    await deleteFile(`banners/${existing.id}`)
  }

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'campaign.updated',
    entity: 'Campaign',
    entityId: existing.id,
  })
  revalidatePath('/campaigns')
  return { success: 'Kampagne gespeichert' }
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const session = await requireSession()
  const { count } = await prisma.campaign.deleteMany({
    where: { id: campaignId, orgId: session.orgId },
  })
  if (count > 0) await deleteFile(`banners/${campaignId}`)
  revalidatePath('/campaigns')
}

/**
 * E-Mail-Kampagne versenden: erstellt fuer jeden Kontakt mit E-Mail und
 * Einwilligung (ohne Opt-out, ohne bereits vorhandene Anfrage in dieser
 * Kampagne) eine ReviewRequest und verschickt die E-Mail ueber SMTP.
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
      // Nur an Kontakte, die eingewilligt haben (DSGVO)
      consentAt: { not: null },
      requests: { none: { campaignId } },
    },
  })

  // Fehlgeschlagene/haengende Anfragen dieser Kampagne erneut versuchen
  const retryRequests = await prisma.reviewRequest.findMany({
    where: {
      campaignId,
      status: { in: ['FAILED', 'PENDING'] },
      contact: { optedOutAt: null, email: { not: null }, consentAt: { not: null } },
    },
    include: { contact: true },
  })

  if (contacts.length === 0 && retryRequests.length === 0) {
    // Genau erklaeren, warum niemand uebrig bleibt
    const [total, withEmail, optedOut, alreadySent, withoutConsent] = await Promise.all([
      prisma.contact.count({ where: { orgId: session.orgId } }),
      prisma.contact.count({ where: { orgId: session.orgId, email: { not: null } } }),
      prisma.contact.count({ where: { orgId: session.orgId, optedOutAt: { not: null } } }),
      prisma.contact.count({
        where: { orgId: session.orgId, requests: { some: { campaignId } } },
      }),
      prisma.contact.count({
        where: { orgId: session.orgId, email: { not: null }, optedOutAt: null, consentAt: null },
      }),
    ])
    if (total === 0) return { error: 'Noch keine Kontakte vorhanden – zuerst unter „Kontakte“ anlegen oder per CSV importieren.' }
    if (withEmail === 0) return { error: `${total} Kontakt(e) vorhanden, aber keiner hat eine E-Mail-Adresse.` }
    if (alreadySent > 0)
      return {
        error: `Alle passenden Kontakte (${alreadySent}) haben aus dieser Kampagne bereits eine Anfrage erhalten. Neue Kontakte anlegen oder eine neue Kampagne erstellen.`,
      }
    if (withoutConsent > 0)
      return {
        error: `${withoutConsent} Kontakt(e) mit E-Mail, aber ohne Einwilligung – Kampagnen gehen nur an eingewilligte Kontakte. Unter „Kontakte“ die Einwilligung erfassen oder per Bestaetigungs-Mail anfragen.`,
      }
    if (optedOut > 0) return { error: `Alle Kontakte mit E-Mail haben sich abgemeldet (Opt-out: ${optedOut}).` }
    return { error: 'Keine passenden Kontakte (mit E-Mail, Einwilligung, ohne Opt-out) gefunden.' }
  }

  let sent = 0
  let failed = 0
  let lastError: string | undefined

  type SendTarget = {
    requestId: string
    token: string
    contact: { firstName: string; lastName: string | null; email: string | null; optOutToken: string }
  }

  // Banner-Bild wird per URL eingebunden (E-Mail-Clients laden es beim Oeffnen)
  const banner = campaign.bannerType
    ? {
        url: appUrl(`/api/campaigns/${campaign.id}/banner`),
        link: campaign.bannerLink ?? undefined,
      }
    : undefined

  // Ein gepoolter, gedrosselter Mailer fuer den gesamten Versand –
  // eine SMTP-Sitzung statt Verbindung pro Mail (Zustellbarkeit)
  const mailer = await createMailer(session.orgId, { fromName: campaign.org.name })
  if (!mailer) return { error: 'Kein SMTP konfiguriert – unter Einstellungen hinterlegen.' }

  async function deliver(target: SendTarget) {
    const vars = {
      vorname: target.contact.firstName,
      nachname: target.contact.lastName ?? '',
      firma: campaign!.org.name,
      standort: location!.name,
      bewertungslink: appUrl(`/f/${location!.slug}?t=${target.token}`),
      abmeldelink: appUrl(`/opt-out/${target.contact.optOutToken}`),
    }
    const text = renderTemplate(campaign!.emailBody ?? DEFAULT_EMAIL_BODY, vars)
    const result = await mailer!.send({
      to: target.contact.email!,
      subject: renderTemplate(campaign!.emailSubject ?? DEFAULT_EMAIL_SUBJECT, vars),
      text,
      html: renderEmailHtml(text, banner),
      unsubscribeUrl: appUrl(`/api/opt-out/${target.contact.optOutToken}`),
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

  try {
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
  } finally {
    mailer.close()
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
