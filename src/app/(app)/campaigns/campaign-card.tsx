'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Pencil, Trash2, X } from 'lucide-react'
import { deleteCampaign } from '@/server/campaign-actions'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CampaignForm, type CampaignFormData } from './campaign-form'
import { SendButton } from './send-button'

const statusLabels: Record<string, { label: string; variant: 'secondary' | 'success' | 'warning' }> = {
  DRAFT: { label: 'Entwurf', variant: 'secondary' },
  ACTIVE: { label: 'Aktiv', variant: 'success' },
  PAUSED: { label: 'Pausiert', variant: 'warning' },
  ARCHIVED: { label: 'Archiviert', variant: 'secondary' },
}

export type CampaignCardData = CampaignFormData & {
  status: string
  channel: string
  createdAt: Date
  requestCount: number
  delivered: number
  failed: number
}

export function CampaignCard({
  campaign,
  locations,
  orgName,
}: {
  campaign: CampaignCardData
  locations: { id: string; name: string }[]
  orgName: string
}) {
  const [editing, setEditing] = useState(false)
  const status = statusLabels[campaign.status] ?? statusLabels.DRAFT

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium">{campaign.name}</p>
            <p className="text-sm text-zinc-500">
              {format(campaign.createdAt, 'dd.MM.yyyy')} · {campaign.requestCount} Anfragen
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={status.variant}>{status.label}</Badge>
              <Badge variant="outline">{campaign.channel}</Badge>
              {campaign.delivered > 0 && (
                <Badge variant="success">{campaign.delivered} zugestellt</Badge>
              )}
              {campaign.failed > 0 && (
                <Badge variant="destructive">{campaign.failed} fehlgeschlagen</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {campaign.channel === 'EMAIL' && <SendButton campaignId={campaign.id} />}
            <Button
              variant="ghost"
              size="icon"
              aria-label={editing ? 'Bearbeiten schliessen' : 'Kampagne bearbeiten'}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? (
                <X className="h-4 w-4 text-zinc-400" />
              ) : (
                <Pencil className="h-4 w-4 text-zinc-400" />
              )}
            </Button>
            <form action={deleteCampaign.bind(null, campaign.id)}>
              <Button variant="ghost" size="icon" aria-label="Kampagne loeschen">
                <Trash2 className="h-4 w-4 text-zinc-400" />
              </Button>
            </form>
          </div>
        </div>

        {editing && (
          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <CampaignForm locations={locations} orgName={orgName} campaign={campaign} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
