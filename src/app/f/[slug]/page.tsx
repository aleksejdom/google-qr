import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { FeedbackFunnel } from './funnel'

/**
 * Oeffentlicher Bewertungs-Funnel: Kunde waehlt Sterne.
 * Ab dem Schwellwert des Standorts geht es zu den externen Bewertungslinks
 * (z. B. Google), darunter zum internen Feedbackformular.
 */
export default async function FunnelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { slug } = await params
  const { t } = await searchParams

  const location = await prisma.location.findUnique({
    where: { slug },
    include: {
      org: { select: { name: true } },
      reviewLinks: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!location) notFound()

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <FeedbackFunnel
        locationSlug={location.slug}
        locationName={location.name}
        orgName={location.org.name}
        threshold={location.feedbackThreshold}
        requestToken={t}
        externalLinks={location.reviewLinks.map((l) => ({
          label: l.label,
          platform: l.platform,
          url: l.targetUrl,
        }))}
      />
    </main>
  )
}
