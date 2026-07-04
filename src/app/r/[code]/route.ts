import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { appUrl } from '@/lib/utils'

/**
 * Kurzlink: /r/{code} – zaehlt anonym (Zeitpunkt + Quelle) und leitet
 * zum Bewertungs-Funnel des Standorts weiter.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const link = await prisma.reviewLink.findUnique({
    where: { code },
    include: { location: true },
  })
  if (!link) {
    // Nicht request.url verwenden: hinter dem Reverse-Proxy ist das localhost:3000
    return NextResponse.redirect(appUrl('/'))
  }

  const source = request.nextUrl.searchParams.get('src') === 'qr' ? 'QR' : 'LINK'
  await prisma.scanEvent.create({
    data: { reviewLinkId: link.id, source },
  })

  return NextResponse.redirect(appUrl(`/f/${link.location.slug}`))
}
