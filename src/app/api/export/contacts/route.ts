import { NextResponse } from 'next/server'
import Papa from 'papaparse'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

/** CSV-Export aller Kontakte der eigenen Organisation. */
export async function GET() {
  const session = await auth()
  if (!session?.user?.orgId) return new NextResponse('Nicht angemeldet', { status: 401 })

  const contacts = await prisma.contact.findMany({
    where: { orgId: session.user.orgId },
    orderBy: { createdAt: 'desc' },
  })

  const csv = Papa.unparse(
    contacts.map((c) => ({
      vorname: c.firstName,
      nachname: c.lastName ?? '',
      email: c.email ?? '',
      telefon: c.phone ?? '',
      opt_out: c.optedOutAt ? c.optedOutAt.toISOString() : '',
      einwilligung_erfasst: c.consentAt ? c.consentAt.toISOString() : '',
      einwilligung_bestaetigt: c.consentConfirmedAt ? c.consentConfirmedAt.toISOString() : '',
      erstellt: c.createdAt.toISOString(),
    }))
  )

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    action: 'contact.csv_export',
    meta: { count: contacts.length },
  })

  return new NextResponse(`﻿${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="kontakte.csv"',
    },
  })
}
