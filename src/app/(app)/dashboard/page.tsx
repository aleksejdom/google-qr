import { subDays, format, eachDayOfInterval } from 'date-fns'
import { de } from 'date-fns/locale'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScansChart } from './scans-chart'

export default async function DashboardPage() {
  const session = await requireSession()
  const since = subDays(new Date(), 29)

  const [contactCount, sentCount, feedbackAgg, openTasks, scans, ratingRows] = await Promise.all([
    prisma.contact.count({ where: { orgId: session.orgId, optedOutAt: null } }),
    prisma.reviewRequest.count({
      where: { orgId: session.orgId, status: { in: ['SENT', 'REMINDED', 'COMPLETED'] } },
    }),
    prisma.feedbackEntry.aggregate({
      where: { orgId: session.orgId },
      _count: true,
      _avg: { rating: true },
    }),
    prisma.task.count({ where: { orgId: session.orgId, status: { not: 'DONE' } } }),
    prisma.scanEvent.findMany({
      where: { reviewLink: { location: { orgId: session.orgId } }, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.feedbackEntry.groupBy({
      by: ['rating'],
      where: { orgId: session.orgId },
      _count: true,
    }),
  ])

  const scansByDay = new Map<string, number>()
  for (const scan of scans) {
    const key = format(scan.createdAt, 'yyyy-MM-dd')
    scansByDay.set(key, (scansByDay.get(key) ?? 0) + 1)
  }
  const chartData = eachDayOfInterval({ start: since, end: new Date() }).map((day) => ({
    day: format(day, 'd. MMM', { locale: de }),
    scans: scansByDay.get(format(day, 'yyyy-MM-dd')) ?? 0,
  }))

  const ratingCounts = new Map(ratingRows.map((r) => [r.rating, r._count]))
  const ratingData = [1, 2, 3, 4, 5].map((stars) => ({
    stars: `${stars}★`,
    anzahl: ratingCounts.get(stars) ?? 0,
  }))

  const kpis = [
    { label: 'Scans (30 Tage)', value: scans.length },
    { label: 'Aktive Kontakte', value: contactCount },
    { label: 'Anfragen gesendet', value: sentCount },
    { label: 'Feedback erhalten', value: feedbackAgg._count },
    {
      label: 'Ø Bewertung (intern)',
      value: feedbackAgg._avg.rating ? feedbackAgg._avg.rating.toFixed(1) : '–',
    },
    { label: 'Offene Aufgaben', value: openTasks },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-500">Ueberblick fuer {session.orgName}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{kpi.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>QR- & Link-Aufrufe</CardTitle>
            <CardDescription>Anonyme Scans der letzten 30 Tage</CardDescription>
          </CardHeader>
          <CardContent>
            <ScansChart data={chartData} xKey="day" yKey="scans" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Bewertungsverteilung</CardTitle>
            <CardDescription>Internes Feedback nach Sternen</CardDescription>
          </CardHeader>
          <CardContent>
            <ScansChart data={ratingData} xKey="stars" yKey="anzahl" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
