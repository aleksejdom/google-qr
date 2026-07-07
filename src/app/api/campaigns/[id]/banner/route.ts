import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { readFile } from '@/lib/storage'

/**
 * Oeffentlich: Banner-Bild einer Kampagne (wird in E-Mails per URL eingebunden,
 * E-Mail-Clients laden es ohne Login).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { bannerType: true },
  })
  if (!campaign?.bannerType) return new NextResponse('Nicht gefunden', { status: 404 })

  const data = await readFile(`banners/${id}`)
  if (!data) return new NextResponse('Nicht gefunden', { status: 404 })

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': campaign.bannerType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
