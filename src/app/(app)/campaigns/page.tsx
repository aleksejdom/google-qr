import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CampaignForm } from './campaign-form'
import { CampaignCard, type CampaignCardData } from './campaign-card'

export default async function CampaignsPage() {
  const session = await requireSession()
  const [org, campaigns, locations] = await Promise.all([
    prisma.organization.findUnique({ where: { id: session.orgId } }),
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

  const orgName = org?.name ?? ''
  const locationOptions = locations.map((l) => ({ id: l.id, name: l.name }))
  const cards: CampaignCardData[] = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    channel: campaign.channel,
    createdAt: campaign.createdAt,
    locationId: campaign.locationId,
    emailSubject: campaign.emailSubject,
    emailBody: campaign.emailBody,
    bannerLink: campaign.bannerLink,
    hasBanner: Boolean(campaign.bannerType),
    requestCount: campaign._count.requests,
    delivered: campaign.requests.filter((r) =>
      ['SENT', 'REMINDED', 'COMPLETED'].includes(r.status)
    ).length,
    failed: campaign.requests.filter((r) => r.status === 'FAILED').length,
  }))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Kampagnen</h1>
        <p className="text-sm text-zinc-500">
          Bewertungsanfragen per E-Mail an Ihre Kontakte – mit Platzhaltern wie{' '}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{'{{vorname}}'}</code>.
          Versendet wird nur an Kontakte mit Einwilligung.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {cards.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-zinc-500">
                Noch keine Kampagnen. Legen Sie rechts die erste an.
              </CardContent>
            </Card>
          )}
          {cards.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              locations={locationOptions}
              orgName={orgName}
            />
          ))}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Neue Kampagne</CardTitle>
            <CardDescription>
              Platzhalter: {'{{vorname}}'}, {'{{firma}}'}, {'{{bewertungslink}}'}, {'{{abmeldelink}}'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignForm locations={locationOptions} orgName={orgName} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
