import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import sharp from 'sharp'
import { prisma } from '@/lib/db'
import { readFile } from '@/lib/storage'
import { appUrl } from '@/lib/utils'

/**
 * QR-Code als PNG: /api/qr/{code}?size=600&logo=1&direct=1
 * Der QR-Code zeigt auf den Kurzlink /r/{code}?src=qr (anonymes Tracking).
 * Mit direct=1 fuehrt der Scan direkt zur externen Bewertungsseite statt
 * zum Funnel. Ist ein Organisations-Logo hochgeladen, wird es eingebettet.
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
  if (!link) return new NextResponse('Nicht gefunden', { status: 404 })

  const size = Math.min(Number(request.nextUrl.searchParams.get('size') ?? 600), 2000)
  const withLogo = request.nextUrl.searchParams.get('logo') !== '0'
  const direct = request.nextUrl.searchParams.get('direct') === '1'
  const target = appUrl(`/r/${code}?src=qr${direct ? '&direct=1' : ''}`)

  let png = await QRCode.toBuffer(target, {
    type: 'png',
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H', // hohe Fehlerkorrektur, damit das Logo Platz hat
    color: { dark: '#18181b', light: '#ffffff' },
  })

  if (withLogo) {
    const logo = await readFile(`logos/${link.location.orgId}.png`)
    if (logo) {
      const logoSize = Math.round(size * 0.22)
      const padded = Math.round(logoSize * 1.15)
      const resizedLogo = await sharp(logo)
        .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toBuffer()
      // weisser Hintergrund hinter dem Logo, damit der QR-Code lesbar bleibt
      const logoWithBg = await sharp({
        create: { width: padded, height: padded, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
      })
        .composite([{ input: resizedLogo, gravity: 'center' }])
        .png()
        .toBuffer()
      png = await sharp(png)
        .composite([{ input: logoWithBg, gravity: 'center' }])
        .png()
        .toBuffer()
    }
  }

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename="qr-${code}.png"`,
    },
  })
}
