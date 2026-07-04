import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { deleteCampaign } from '@/server/campaign-actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CampaignForm } from './campaign-form'
import { SendButton } from './send-button'
import { Trash2 } from 'lucide-react'

const statusLabels: Record<string, { label: string; variant: 'secondary' | 'success' | 'warning' }> = {
  DRAFT: { label: 'Entwurf', variant: 'secondary' },
  ACTIVE: { label: 'Aktiv', variant: 'success' },
  PAUSED: { label: 'Pausiert', variant: 'warning' },
  ARCHIVED: { label: 'Archiviert', variant: 'secondary' },
}

export default async function CampaignsPage() {
  const session = await requireSession()
  const [campaigns, locations] = await Promise.all([
    prisma.campaign.findMany({
      where: { orgId: session.orgId },
      include: {
        _count: { select: { requests: true } },
        requests: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.location.findMany({ where: { orgId: session.orgId }, orderBy: { name: 'asc' } }),
  ])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kampagnen</h1>
        <p className="text-sm text-zinc-500">
          Bewertungsanfragen per E-Mail an Ihre Kontakte – mit Platzhaltern wie{' '}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{'{{vorname}}'}</code>.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {campaigns.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-zinc-500">
                Noch keine Kampagnen. Legen Sie rechts die erste an.
              </CardContent>
            </Card>
          )}
          {campaigns.map((campaign) => {
            const status = statusLabels[campaign.status] ?? statusLabels.DRAFT
            const delivered = campaign.requests.filter((r) =>
              ['SENT', 'REMINDED', 'COMPLETED'].includes(r.status)
            ).length
            const failedCount = campaign.requests.filter((r) => r.status === 'FAILED').length
            return (
              <Card key={campaign.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-sm text-zinc-500">
                      {format(campaign.createdAt, 'dd.MM.yyyy')} · {campaign._count.requests}{' '}
                      Anfragen
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <Badge variant="outline">{campaign.channel}</Badge>
                      {delivered > 0 && <Badge variant="success">{delivered} zugestellt</Badge>}
                      {failedCount > 0 && (
                        <Badge variant="destructive">{failedCount} fehlgeschlagen</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {campaign.channel === 'EMAIL' && <SendButton campaignId={campaign.id} />}
                    <form action={deleteCampaign.bind(null, campaign.id)}>
                      <Button variant="ghost" size="icon" aria-label="Kampagne loeschen">
                        <Trash2 className="h-4 w-4 text-zinc-400" />
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Neue Kampagne</CardTitle>
            <CardDescription>
              Platzhalter: {'{{vorname}}'}, {'{{firma}}'}, {'{{bewertungslink}}'}, {'{{abmeldelink}}'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignForm locations={locations.map((l) => ({ id: l.id, name: l.name }))} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
