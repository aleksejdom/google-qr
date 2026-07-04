'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { randomCode, slugify } from '@/lib/utils'
import type { ActionState } from '@/server/auth-actions'

const locationSchema = z.object({
  name: z.string().min(2, 'Name ist zu kurz'),
  address: z.string().optional(),
  feedbackThreshold: z.coerce.number().int().min(1).max(5).default(4),
})

export async function createLocation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  const parsed = locationSchema.safeParse({
    name: formData.get('name'),
    address: formData.get('address') || undefined,
    feedbackThreshold: formData.get('feedbackThreshold') || 4,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  let slug = slugify(parsed.data.name) || 'standort'
  if (await prisma.location.findUnique({ where: { slug } })) {
    slug = `${slug}-${randomCode(4).toLowerCase()}`
  }

  const location = await prisma.location.create({
    data: { ...parsed.data, slug, orgId: session.orgId },
  })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'location.created',
    entity: 'Location',
    entityId: location.id,
  })
  revalidatePath('/locations')
  return { success: 'Standort angelegt' }
}

export async function deleteLocation(locationId: string): Promise<void> {
  const session = await requireSession()
  await prisma.location.deleteMany({ where: { id: locationId, orgId: session.orgId } })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'location.deleted',
    entity: 'Location',
    entityId: locationId,
  })
  revalidatePath('/locations')
}

const linkSchema = z.object({
  locationId: z.string().min(1),
  platform: z.enum(['GOOGLE', 'FACEBOOK', 'TRUSTPILOT', 'CUSTOM']),
  label: z.string().min(1, 'Bezeichnung fehlt'),
  targetUrl: z.string().url('Ungueltige URL'),
})

export async function createReviewLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireSession()
  const parsed = linkSchema.safeParse({
    locationId: formData.get('locationId'),
    platform: formData.get('platform'),
    label: formData.get('label'),
    targetUrl: formData.get('targetUrl'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  // Standort muss zur Organisation gehoeren
  const location = await prisma.location.findFirst({
    where: { id: parsed.data.locationId, orgId: session.orgId },
  })
  if (!location) return { error: 'Standort nicht gefunden' }

  const link = await prisma.reviewLink.create({
    data: { ...parsed.data, code: randomCode() },
  })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'reviewlink.created',
    entity: 'ReviewLink',
    entityId: link.id,
  })
  revalidatePath(`/locations/${location.id}`)
  return { success: 'Bewertungslink angelegt' }
}

/** Ergebnis des Google-Review-Link-Generators */
export type GenerateResult = { url?: string; error?: string }

function extractGoogleReviewUrl(url: string): string | null {
  let decoded = url
  try {
    decoded = decodeURIComponent(url)
  } catch {
    // ungueltige Escapes ignorieren, mit Original weiterarbeiten
  }

  // 1) Echte Place-ID (ChIJ…) direkt im Link
  const placeId =
    decoded.match(/place_id[=:]\s*([A-Za-z0-9_-]{20,})/) ??
    decoded.match(/placeid=([A-Za-z0-9_-]{20,})/) ??
    decoded.match(/(ChIJ[A-Za-z0-9_-]{16,})/)
  if (placeId) {
    return `https://search.google.com/local/writereview?placeid=${placeId[1]}`
  }

  // 2) Feature-ID (0x…:0x…) aus Maps-URLs – !12e1 oeffnet den Rezensions-Dialog
  const ftid =
    decoded.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i) ??
    decoded.match(/ftid=(0x[0-9a-f]+:0x[0-9a-f]+)/i) ??
    decoded.match(/(0x[0-9a-f]{8,}:0x[0-9a-f]{8,})/i)
  if (ftid) {
    return `https://www.google.com/maps/place//data=!4m3!3m2!1s${ftid[1]}!12e1`
  }

  return null
}

/**
 * Google-Bewertungslink aus einem Google-Maps-Unternehmenslink erzeugen.
 * Unterstuetzt lange Maps-URLs und Kurzlinks (maps.app.goo.gl / goo.gl),
 * die serverseitig aufgeloest werden. Keine Google-API noetig.
 */
export async function generateGoogleReviewLink(mapsUrl: string): Promise<GenerateResult> {
  await requireSession()

  const input = mapsUrl.trim()
  if (!input) return { error: 'Bitte einen Google-Maps-Link einfuegen' }

  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    return { error: 'Das ist keine gueltige URL' }
  }
  if (!/(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$|(^|\.)maps\.app\.goo\.gl$/.test(parsed.hostname)) {
    return { error: 'Bitte einen Link von Google Maps einfuegen' }
  }

  // Direkt aus der URL extrahieren
  let reviewUrl = extractGoogleReviewUrl(input)

  // Kurzlink oder URL ohne IDs: serverseitig aufloesen und erneut versuchen
  if (!reviewUrl) {
    try {
      const res = await fetch(input, {
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        },
      })
      let finalUrl = res.url
      // EU-Consent-Redirect: eigentliche Ziel-URL steckt im "continue"-Parameter
      if (finalUrl.includes('consent.google.')) {
        const cont = new URL(finalUrl).searchParams.get('continue')
        if (cont) finalUrl = cont
      }
      reviewUrl = extractGoogleReviewUrl(finalUrl)

      // Letzter Versuch: IDs im HTML der Seite suchen
      if (!reviewUrl && res.ok) {
        const html = await res.text()
        reviewUrl = extractGoogleReviewUrl(html.slice(0, 500_000))
      }
    } catch {
      // Netzwerkfehler unten als generischer Hinweis
    }
  }

  if (!reviewUrl) {
    return {
      error:
        'Konnte keine Unternehmens-ID im Link finden. Bitte in Google Maps das Unternehmen oeffnen, auf "Teilen" klicken und den Link hier einfuegen.',
    }
  }
  return { url: reviewUrl }
}

export async function deleteReviewLink(linkId: string): Promise<void> {
  const session = await requireSession()
  const link = await prisma.reviewLink.findFirst({
    where: { id: linkId, location: { orgId: session.orgId } },
  })
  if (!link) return
  await prisma.reviewLink.delete({ where: { id: linkId } })
  await logAudit({
    orgId: session.orgId,
    userId: session.userId,
    action: 'reviewlink.deleted',
    entity: 'ReviewLink',
    entityId: linkId,
  })
  revalidatePath(`/locations/${link.locationId}`)
}
