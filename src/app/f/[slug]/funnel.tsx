'use client'

import { useActionState, useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitFeedback, markRequestCompleted } from '@/server/feedback-actions'
import type { ActionState } from '@/server/auth-actions'

type ExternalLink = { label: string; platform: string; url: string }

export function FeedbackFunnel(props: {
  locationSlug: string
  locationName: string
  orgName: string
  threshold: number
  requestToken?: string
  externalLinks: ExternalLink[]
}) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(submitFeedback, {})

  const positive = rating >= props.threshold

  if (state.success) {
    return (
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-xl font-semibold">Vielen Dank!</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Ihr Feedback hilft uns, besser zu werden.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="mb-1 text-center text-xl font-semibold">{props.locationName}</h1>
      <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Wie zufrieden waren Sie mit {props.orgName}?
      </p>

      <div className="mb-6 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} Sterne`}
            onClick={() => setRating(value)}
            onMouseEnter={() => setHover(value)}
            onMouseLeave={() => setHover(0)}
            className="transition-transform hover:scale-110"
          >
            <Star
              size={36}
              className={
                value <= (hover || rating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-zinc-300 dark:text-zinc-600'
              }
            />
          </button>
        ))}
      </div>

      {rating > 0 && positive && (
        <div className="space-y-3">
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Das freut uns sehr! Teilen Sie Ihre Erfahrung gerne oeffentlich:
          </p>
          {props.externalLinks.length === 0 && (
            <p className="text-center text-sm text-zinc-400">
              (Noch keine Bewertungslinks hinterlegt)
            </p>
          )}
          {props.externalLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (props.requestToken) void markRequestCompleted(props.requestToken)
              }}
              className="block w-full rounded-md bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Auf {link.label} bewerten
            </a>
          ))}
        </div>
      )}

      {rating > 0 && !positive && (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locationSlug" value={props.locationSlug} />
          <input type="hidden" name="rating" value={rating} />
          {props.requestToken && (
            <input type="hidden" name="requestToken" value={props.requestToken} />
          )}
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Das tut uns leid. Was koennen wir besser machen?
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="comment">Ihr Feedback</Label>
            <Textarea
              id="comment"
              name="comment"
              placeholder="Beschreiben Sie kurz, was nicht gepasst hat …"
              rows={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">E-Mail fuer Rueckfragen (optional)</Label>
            <Input id="contactEmail" name="contactEmail" type="email" placeholder="ihre@email.de" />
          </div>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Wird gesendet …' : 'Feedback absenden'}
          </Button>
          <p className="text-center text-xs text-zinc-400">
            Ihr Feedback geht direkt an das Team und wird nicht veroeffentlicht.
          </p>
        </form>
      )}
    </div>
  )
}
