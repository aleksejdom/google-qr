import { format } from 'date-fns'
import { Star } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ rating?: string }>
}) {
  const session = await requireSession()
  const { rating } = await searchParams
  const ratingFilter = rating ? Number(rating) : undefined

  const entries = await prisma.feedbackEntry.findMany({
    where: {
      orgId: session.orgId,
      ...(ratingFilter ? { rating: ratingFilter } : {}),
    },
    include: { location: { select: { name: true } }, task: { select: { id: true, status: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Internes Feedback</h1>
        <p className="text-sm text-zinc-500">
          Feedback aus dem Bewertungs-Funnel – wird nicht veroeffentlicht.
        </p>
      </div>

      <div className="flex gap-2">
        <a
          href="/feedback"
          className={`rounded-md px-3 py-1.5 text-sm ${!ratingFilter ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800'}`}
        >
          Alle
        </a>
        {[1, 2, 3, 4, 5].map((r) => (
          <a
            key={r}
            href={`/feedback?rating=${r}`}
            className={`rounded-md px-3 py-1.5 text-sm ${ratingFilter === r ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800'}`}
          >
            {r}★
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {entries.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-zinc-500">Kein Feedback vorhanden.</CardContent>
          </Card>
        )}
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardContent className="p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={16}
                      className={
                        s <= entry.rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-zinc-300 dark:text-zinc-600'
                      }
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  {entry.location && <span>{entry.location.name}</span>}
                  <span>{format(entry.createdAt, 'dd.MM.yyyy HH:mm')}</span>
                  {entry.task && (
                    <Badge variant={entry.task.status === 'DONE' ? 'success' : 'warning'}>
                      Aufgabe {entry.task.status === 'DONE' ? 'erledigt' : 'offen'}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-sm">{entry.comment || <em className="text-zinc-400">Kein Kommentar</em>}</p>
              {entry.contactEmail && (
                <p className="mt-2 text-xs text-zinc-500">Rueckfragen: {entry.contactEmail}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
