'use server'

import { z } from 'zod'
import Papa from 'papaparse'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { sendMail, renderTemplate } from '@/lib/mailer'
import { appUrl } from '@/lib/utils'
import type { ActionState } from '@/server/auth-actions'
import {
  CONSENT_EMAIL_SUBJECT,
  CONSENT_EMAIL_BODY,
  CONSENT_TEXT_MANUAL,
} from '@/server/templates'

const contactSchema = z.object({
  firstName: z.string().min(1, 'Vorname fehlt'),
  lastName: z.string().optional(),
  email: z.string().email('Ungueltige E-Mail').optional().or(z.literal('')),
  phone: z.string().optional(),
})

export async function createContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  const parsed = contactSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName') || undefined,
    email: formData.get('email') || '',
    phone: formData.get('phone') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const email = parsed.data.email?.toLowerCase().trim() || null
  if (email) {
    const dupe = await prisma.contact.findFirst({ where: { orgId: session.orgId, email } })
    if (dupe) return { error: 'Kontakt mit dieser E-Mail existiert bereits' }
  }

  const hasConsent = formData.get('consent') === 'on'
  const contact = await prisma.contact.create({
    data: {
      orgId: session.orgId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email,
      phone: parsed.data.phone,
      consentAt: hasConsent ? new Date() : null,
      consentText: hasConsent ? CONSENT_TEXT_MANUAL : null,
    },
  })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'contact.created',
    entity: 'Contact',
    entityId: contact.id,
  })
  revalidatePath('/contacts')
  return { success: 'Kontakt angelegt' }
}

/** DSGVO: Kontakt endgueltig loeschen (inkl. Anfragen via Cascade). */
export async function deleteContact(contactId: string): Promise<void> {
  const session = await requireSession()
  await prisma.contact.deleteMany({ where: { id: contactId, orgId: session.orgId } })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'contact.deleted_gdpr',
    entity: 'Contact',
    entityId: contactId,
  })
  revalidatePath('/contacts')
}

/**
 * Double-Opt-in: Bestaetigungs-E-Mail an den Kontakt senden.
 * Der Kontakt bestaetigt per Link (/consent/[token]), dass er
 * Bewertungsanfragen per E-Mail erhalten moechte.
 */
export async function requestConsent(contactId: string): Promise<ActionState> {
  const session = await requireSession()
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, orgId: session.orgId },
    include: { org: true },
  })
  if (!contact) return { error: 'Kontakt nicht gefunden' }
  if (!contact.email) return { error: 'Kontakt hat keine E-Mail-Adresse' }
  if (contact.optedOutAt) return { error: 'Kontakt hat sich abgemeldet (Opt-out)' }
  if (contact.consentConfirmedAt) return { error: 'Einwilligung wurde bereits bestaetigt' }

  const vars = {
    vorname: contact.firstName,
    nachname: contact.lastName ?? '',
    firma: contact.org.name,
    bestaetigungslink: appUrl(`/consent/${contact.consentToken}`),
    abmeldelink: appUrl(`/opt-out/${contact.optOutToken}`),
  }
  const result = await sendMail({
    orgId: session.orgId,
    to: contact.email,
    subject: renderTemplate(CONSENT_EMAIL_SUBJECT, vars),
    text: renderTemplate(CONSENT_EMAIL_BODY, vars),
  })
  if (!result.ok) return { error: `Versand fehlgeschlagen: ${result.error ?? 'Unbekannter Fehler'}` }

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'contact.consent_requested',
    entity: 'Contact',
    entityId: contact.id,
  })
  return { success: `Bestaetigungs-E-Mail an ${contact.email} versendet` }
}

/**
 * CSV-Import. Erwartete Spalten (Kopfzeile, flexibel):
 * vorname/firstName, nachname/lastName, email, telefon/phone,
 * einwilligung/consent (ja/yes/true/1 = Einwilligung liegt vor)
 */
export async function importContactsCsv(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Keine CSV-Datei ausgewaehlt' }
  if (file.size > 5 * 1024 * 1024) return { error: 'Datei ist groesser als 5 MB' }

  const text = await file.text()
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  let imported = 0
  let skipped = 0
  for (const row of result.data) {
    const firstName = row['vorname'] ?? row['firstname'] ?? row['first_name'] ?? ''
    const lastName = row['nachname'] ?? row['lastname'] ?? row['last_name'] ?? ''
    const email = (row['email'] ?? row['e-mail'] ?? '').toLowerCase().trim()
    const phone = row['telefon'] ?? row['phone'] ?? row['tel'] ?? ''
    const consentRaw = (row['einwilligung'] ?? row['consent'] ?? '').toLowerCase().trim()
    const hasConsent = ['ja', 'yes', 'true', '1', 'x'].includes(consentRaw)

    if (!firstName && !email) {
      skipped++
      continue
    }
    if (email) {
      const dupe = await prisma.contact.findFirst({ where: { orgId: session.orgId, email } })
      if (dupe) {
        skipped++
        continue
      }
    }
    await prisma.contact.create({
      data: {
        orgId: session.orgId,
        firstName: firstName || email.split('@')[0],
        lastName: lastName || null,
        email: email || null,
        phone: phone || null,
        consentAt: hasConsent ? new Date() : null,
        consentText: hasConsent ? CONSENT_TEXT_MANUAL : null,
      },
    })
    imported++
  }

  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'contact.csv_import',
    meta: { imported, skipped },
  })
  revalidatePath('/contacts')
  return { success: `${imported} Kontakte importiert, ${skipped} uebersprungen` }
}
