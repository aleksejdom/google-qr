import { NextResponse } from 'next/server'
import { optOutByToken } from '@/lib/opt-out'
import { appUrl } from '@/lib/utils'

/**
 * One-Click-Unsubscribe (RFC 8058): E-Mail-Clients wie Gmail/Yahoo senden
 * einen POST an die URL aus dem List-Unsubscribe-Header, ohne dass der
 * Empfaenger eine Seite oeffnen muss. Pflicht fuer Bulk-Versand, verbessert
 * die Zustellbarkeit deutlich.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  await optOutByToken(token)
  // Immer 200, damit keine Rueckschluesse auf gueltige Tokens moeglich sind
  return new NextResponse(null, { status: 200 })
}

/** Manuelle Aufrufe (z. B. Klick auf die URL) auf die Abmelde-Seite leiten. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  return NextResponse.redirect(appUrl(`/opt-out/${token}`))
}
