import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

/** DSGVO-Datenexport: alle gespeicherten Daten eines Kontakts als JSON. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.orgId) return new NextResponse('Nicht angemeldet', { status: 401 })

  const { id } = await params
  const contact = await prisma.contact.findFirst({
    where: { id, orgId: session.user.orgId },
    include: {
      requests: {
        include: { feedback: true, campaign: { select: { name: true } } },
      },
    },
  })
  if (!contact) return new NextResponse('Nicht gefunden', { status: 404 })

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: 'contact.gdpr_export',
    entity: 'Contact',
    entityId: id,
  })

  return NextResponse.json(
    {
      exportiert_am: new Date().toISOString(),
      kontakt: {
        vorname: contact.firstName,
        nachname: contact.lastName,
        email: contact.email,
        telefon: contact.phone,
        opt_out: contact.optedOutAt,
        erstellt: contact.createdAt,
      },
      bewertungsanfragen: contact.requests.map((r) => ({
        kampagne: r.campaign?.name ?? null,
        kanal: r.channel,
        status: r.status,
        gesendet: r.sentAt,
        erinnert: r.remindedAt,
        feedback: r.feedback
          ? { sterne: r.feedback.rating, kommentar: r.feedback.comment, datum: r.feedback.createdAt }
          : null,
      })),
    },
    {
      headers: {
        'Content-Disposition': `attachment; filename="dsgvo-export-${id}.json"`,
      },
    }
  )
}
