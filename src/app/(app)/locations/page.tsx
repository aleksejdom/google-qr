import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { deleteLocation } from '@/server/location-actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LocationForm } from './location-form'
import { Trash2, QrCode } from 'lucide-react'

export default async function LocationsPage() {
  const session = await requireSession()
  const locations = await prisma.location.findMany({
    where: { orgId: session.orgId },
    include: { _count: { select: { reviewLinks: true, feedback: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Standorte & QR-Codes</h1>
        <p className="text-sm text-zinc-500">
          Jeder Standort hat einen Bewertungs-Funnel, Bewertungslinks und QR-Codes.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {locations.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-zinc-500">
                Noch keine Standorte. Legen Sie rechts den ersten Standort an.
              </CardContent>
            </Card>
          )}
          {locations.map((location) => (
            <Card key={location.id}>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <Link
                    href={`/locations/${location.id}`}
                    className="font-medium hover:underline"
                  >
                    {location.name}
                  </Link>
                  <p className="truncate text-sm text-zinc-500">
                    {location.address || 'Keine Adresse hinterlegt'}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="secondary">
                      {location._count.reviewLinks} Link{location._count.reviewLinks === 1 ? '' : 's'}
                    </Badge>
                    <Badge variant="secondary">{location._count.feedback} Feedback</Badge>
                    <Badge variant="outline">ab {location.feedbackThreshold}★ extern</Badge>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/locations/${location.id}`}>
                    <Button variant="outline" size="sm">
                      <QrCode className="h-4 w-4" /> Links & QR
                    </Button>
                  </Link>
                  <form action={deleteLocation.bind(null, location.id)}>
                    <Button variant="ghost" size="icon" aria-label="Standort loeschen">
                      <Trash2 className="h-4 w-4 text-zinc-400" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Neuer Standort</CardTitle>
            <CardDescription>Name, Adresse und Feedback-Schwelle</CardDescription>
          </CardHeader>
          <CardContent>
            <LocationForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
