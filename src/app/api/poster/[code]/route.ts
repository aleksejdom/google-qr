import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { prisma } from '@/lib/db'
import { appUrl } from '@/lib/utils'

/** A4-Poster mit QR-Code fuer den Aushang: /api/poster/{code}?direct=1 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const link = await prisma.reviewLink.findUnique({
    where: { code },
    include: { location: { include: { org: true } } },
  })
  if (!link) return new NextResponse('Nicht gefunden', { status: 404 })

  const direct = new URL(request.url).searchParams.get('direct') === '1'
  const qrPng = await QRCode.toBuffer(appUrl(`/r/${code}?src=qr${direct ? '&direct=1' : ''}`), {
    type: 'png',
    width: 900,
    margin: 1,
    errorCorrectionLevel: 'M',
  })

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 in pt
  const { width, height } = page.getSize()
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const qrImage = await pdf.embedPng(qrPng)

  const dark = rgb(0.09, 0.09, 0.11)

  const title = 'Wie war Ihr Besuch?'
  const titleSize = 34
  page.drawText(title, {
    x: (width - bold.widthOfTextAtSize(title, titleSize)) / 2,
    y: height - 120,
    size: titleSize,
    font: bold,
    color: dark,
  })

  const subtitle = `Bewerten Sie ${link.location.org.name} – ${link.location.name}`
  const subSize = 16
  page.drawText(subtitle, {
    x: (width - regular.widthOfTextAtSize(subtitle, subSize)) / 2,
    y: height - 155,
    size: subSize,
    font: regular,
    color: rgb(0.35, 0.35, 0.4),
  })

  const qrSize = 300
  page.drawImage(qrImage, {
    x: (width - qrSize) / 2,
    y: (height - qrSize) / 2 - 30,
    width: qrSize,
    height: qrSize,
  })

  const hint = 'Einfach QR-Code scannen – dauert nur 30 Sekunden.'
  page.drawText(hint, {
    x: (width - regular.widthOfTextAtSize(hint, 14)) / 2,
    y: (height - qrSize) / 2 - 80,
    size: 14,
    font: regular,
    color: rgb(0.35, 0.35, 0.4),
  })

  const url = appUrl(`/r/${code}`)
  page.drawText(url, {
    x: (width - regular.widthOfTextAtSize(url, 11)) / 2,
    y: 60,
    size: 11,
    font: regular,
    color: rgb(0.55, 0.55, 0.6),
  })

  const bytes = await pdf.save()
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="poster-${code}.pdf"`,
    },
  })
}
