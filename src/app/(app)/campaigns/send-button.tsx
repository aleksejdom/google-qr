'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { sendCampaign } from '@/server/campaign-actions'
import { Button } from '@/components/ui/button'

export function SendButton({ campaignId }: { campaignId: string }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm('Bewertungsanfragen jetzt an alle passenden Kontakte senden?')) return
          startTransition(async () => {
            const result = await sendCampaign(campaignId)
            setMessage(
              result.error
                ? { text: result.error, error: true }
                : { text: result.success ?? 'Versendet', error: false }
            )
          })
        }}
      >
        <Send className="h-4 w-4" />
        {pending ? 'Sendet …' : 'Senden'}
      </Button>
      {message && (
        <p className={`max-w-48 text-right text-xs ${message.error ? 'text-red-600' : 'text-emerald-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
