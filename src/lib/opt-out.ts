import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import type { Contact } from '@/generated/prisma/client'

/**
 * Kontakt anhand des Opt-out-Tokens abmelden: setzt optedOutAt und
 * bricht alle offenen Bewertungsanfragen ab. Wird sowohl von der
 * Abmelde-Seite (/opt-out/[token]) als auch vom One-Click-Unsubscribe-
 * Endpoint (List-Unsubscribe-Post, RFC 8058) verwendet.
 */
export async function optOutByToken(token: string): Promise<Contact | null> {
  const contact = await prisma.contact.findUnique({ where: { optOutToken: token } })
  if (!contact) return null

  if (!contact.optedOutAt) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { optedOutAt: new Date() },
    })
    await prisma.reviewRequest.updateMany({
      where: { contactId: contact.id, status: { in: ['PENDING', 'SENT', 'REMINDED'] } },
      data: { status: 'OPTED_OUT' },
    })
    await logAudit({
      orgId: contact.orgId,
      action: 'contact.opted_out',
      entity: 'Contact',
      entityId: contact.id,
    })
  }
  return contact
}
