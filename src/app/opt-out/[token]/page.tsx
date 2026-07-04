import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export default async function OptOutPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const contact = await prisma.contact.findUnique({ where: { optOutToken: token } })

  if (contact && !contact.optedOutAt) {
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-xl font-semibold">Abmeldung bestaetigt</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {contact
            ? 'Sie erhalten keine weiteren Bewertungsanfragen von uns.'
            : 'Dieser Abmeldelink ist ungueltig oder wurde bereits verwendet.'}
        </p>
      </div>
    </main>
  )
}
