import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { CONSENT_TEXT_CONFIRMED } from '@/server/templates'

export default async function ConsentPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const contact = await prisma.contact.findUnique({ where: { consentToken: token } })

  if (contact && !contact.consentConfirmedAt && !contact.optedOutAt) {
    const now = new Date()
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        consentConfirmedAt: now,
        consentAt: contact.consentAt ?? now,
        consentText: CONSENT_TEXT_CONFIRMED,
      },
    })
    await logAudit({
      orgId: contact.orgId,
      action: 'contact.consent_confirmed',
      entity: 'Contact',
      entityId: contact.id,
    })
  }

  const invalid = !contact || Boolean(contact.optedOutAt)

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-xl font-semibold">
          {invalid ? 'Link ungueltig' : 'Einwilligung bestaetigt'}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {invalid
            ? 'Dieser Bestaetigungslink ist ungueltig oder Sie haben sich bereits abgemeldet.'
            : 'Vielen Dank! Sie erhalten kuenftig Bewertungsanfragen per E-Mail. Sie koennen sich jederzeit ueber den Abmeldelink in jeder E-Mail wieder abmelden.'}
        </p>
      </div>
    </main>
  )
}
