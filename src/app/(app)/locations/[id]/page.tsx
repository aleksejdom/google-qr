import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { deleteReviewLink } from '@/server/location-actions'
import { appUrl } from '@/lib/utils'
import { SMS_TEMPLATE } from '@/server/templates'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LinkForm } from './link-form'
import { CopyButton } from './copy-button'
import { ArrowLeft, Trash2, FileText, Download } from 'lucide-react'

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireSession()
  const { id } = await params
  const location = await prisma.location.findFirst({
    where: { id, orgId: session.orgId },
    include: {
      reviewLinks: { include: { _count: { select: { scans: true } } }, orderBy: { createdAt: 'asc' } },
    },
  })
  if (!location) notFound()

  const funnelUrl = appUrl(`/f/${location.slug}`)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link href="/locations" className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          <ArrowLeft className="h-3.5 w-3.5" /> Alle Standorte
        </Link>
        <h1 className="text-2xl font-semibold">{location.name}</h1>
        <p className="text-sm text-zinc-500">
          Funnel:{' '}
          <a href={funnelUrl} target="_blank" className="underline">
            {funnelUrl}
          </a>{' '}
          – ab {location.feedbackThreshold}★ geht es zu den externen Links, darunter zum internen Feedback.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {location.reviewLinks.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-zinc-500">
                Noch keine Bewertungslinks. Rechts z. B. den Google-Bewertungslink hinterlegen.
              </CardContent>
            </Card>
          )}
          {location.reviewLinks.map((link) => {
            const shortUrl = appUrl(`/r/${link.code}`)
            return (
              <Card key={link.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="flex items-start gap-4">
                    {/* QR-Vorschau direkt aus der API */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/qr/${link.code}?size=200`}
                      alt={`QR-Code ${link.label}`}
                      className="h-24 w-24 rounded-md border border-zinc-200 dark:border-zinc-700"
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{link.label}</p>
                      <p className="max-w-xs truncate text-xs text-zinc-500">{link.targetUrl}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{link.platform}</Badge>
                        <Badge variant="outline">{link._count.scans} Scans</Badge>
                      </div>
                      <p className="mt-2 font-mono text-xs text-zinc-500">{shortUrl}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton text={shortUrl} label="Kurzlink" />
                    <a href={`/api/qr/${link.code}?size=1000`} download={`qr-${link.code}.png`}>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4" /> QR PNG
                      </Button>
                    </a>
                    <a href={`/api/poster/${link.code}`} target="_blank">
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4" /> Poster PDF
                      </Button>
                    </a>
                    <form action={deleteReviewLink.bind(null, link.id)}>
                      <Button variant="ghost" size="icon" aria-label="Link loeschen">
                        <Trash2 className="h-4 w-4 text-zinc-400" />
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <Card>
            <CardHeader>
              <CardTitle>SMS- / WhatsApp-Vorlage</CardTitle>
              <CardDescription>
                Kein automatischer Versand im MVP – Vorlage kopieren und manuell senden.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="rounded-md bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-800">
                {SMS_TEMPLATE.replace('{{firma}}', session.orgName).replace(
                  '{{bewertungslink}}',
                  funnelUrl
                )}
              </p>
              <div className="flex gap-2">
                <CopyButton
                  text={SMS_TEMPLATE.replace('{{vorname}}', '')
                    .replace('{{firma}}', session.orgName)
                    .replace('{{bewertungslink}}', funnelUrl)}
                  label="Vorlage"
                />
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Danke fuer Ihren Besuch bei ${session.orgName}! Wir freuen uns ueber Ihre Bewertung: ${funnelUrl}`
                  )}`}
                  target="_blank"
                >
                  <Button variant="outline" size="sm">
                    WhatsApp-Link oeffnen
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Neuer Bewertungslink</CardTitle>
            <CardDescription>z. B. Ihr Google-Bewertungslink</CardDescription>
          </CardHeader>
          <CardContent>
            <LinkForm locationId={location.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
