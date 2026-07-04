import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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
    return NextResponse.redirect(new URL('/', request.url))
  }

  const source = request.nextUrl.searchParams.get('src') === 'qr' ? 'QR' : 'LINK'
  await prisma.scanEvent.create({
    data: { reviewLinkId: link.id, source },
  })

  return NextResponse.redirect(new URL(`/f/${link.location.slug}`, request.url))
}
