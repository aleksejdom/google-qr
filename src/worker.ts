import 'dotenv/config'
import { PgBoss } from 'pg-boss'
import { subDays } from 'date-fns'
import { prisma } from '@/lib/db'
import { sendMail, renderTemplate } from '@/lib/mailer'
import { appUrl } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { REMINDER_EMAIL_SUBJECT, REMINDER_EMAIL_BODY } from '@/server/templates'

const RECALL_QUEUE = 'recall-check'

/**
 * Recall-Worker: prueft stuendlich alle aktiven Recall-Regeln und verschickt
 * Erinnerungs-E-Mails fuer unbeantwortete Bewertungsanfragen.
 * Start: npm run worker
 */
async function processRecalls() {
  const rules = await prisma.recallRule.findMany({
    where: { active: true },
    include: { org: true },
  })

  // Pro Lauf jeden Kontakt nur einmal erinnern (auch bei mehreren offenen Anfragen)
  const remindedContacts = new Set<string>()

  for (const rule of rules) {
    const requests = await prisma.reviewRequest.findMany({
      where: {
        orgId: rule.orgId,
        channel: 'EMAIL',
        status: { in: ['SENT', 'REMINDED'] },
        sentAt: { lte: subDays(new Date(), rule.daysAfter) },
        reminderCount: { lt: rule.maxReminders },
        feedback: null,
        contact: {
          optedOutAt: null,
          email: { not: null },
          // Erinnerungen nur an Kontakte mit Einwilligung (DSGVO)
          consentAt: { not: null },
          // Wer bereits (irgendwo) eine Bewertung abgegeben hat, wird nicht erinnert
          requests: { none: { status: 'COMPLETED' } },
        },
      },
      include: { contact: true, location: true },
      take: 200,
    })

    for (const request of requests) {
      if (remindedContacts.has(request.contactId)) continue
      // Nicht doppelt erinnern, bevor wieder "daysAfter" Tage vergangen sind
      if (request.remindedAt && request.remindedAt > subDays(new Date(), rule.daysAfter)) continue

      const location =
        request.location ??
        (await prisma.location.findFirst({ where: { orgId: rule.orgId } }))
      if (!location) continue

      const vars = {
        vorname: request.contact.firstName,
        firma: rule.org.name,
        standort: location.name,
        bewertungslink: appUrl(`/f/${location.slug}?t=${request.token}`),
        abmeldelink: appUrl(`/opt-out/${request.contact.optOutToken}`),
      }

      const result = await sendMail({
        orgId: rule.orgId,
        to: request.contact.email!,
        subject: renderTemplate(REMINDER_EMAIL_SUBJECT, vars),
        text: renderTemplate(REMINDER_EMAIL_BODY, vars),
        fromName: rule.org.name,
        unsubscribeUrl: appUrl(`/api/opt-out/${request.contact.optOutToken}`),
      })

      if (result.ok) {
        remindedContacts.add(request.contactId)
        await prisma.reviewRequest.update({
          where: { id: request.id },
          data: {
            status: 'REMINDED',
            remindedAt: new Date(),
            reminderCount: { increment: 1 },
          },
        })
        logger.info({ requestId: request.id }, 'Recall-Erinnerung versendet')
      } else {
        logger.warn({ requestId: request.id, error: result.error }, 'Recall fehlgeschlagen')
      }
    }
  }
}

async function main() {
  const boss = new PgBoss(process.env.DATABASE_URL!)
  boss.on('error', (err) => logger.error({ err }, 'pg-boss Fehler'))
  await boss.start()

  await boss.createQueue(RECALL_QUEUE)
  await boss.schedule(RECALL_QUEUE, '0 * * * *') // stuendlich
  await boss.work(RECALL_QUEUE, async () => {
    logger.info('Recall-Pruefung startet')
    await processRecalls()
    logger.info('Recall-Pruefung beendet')
  })

  // Beim Start einmal direkt pruefen
  await boss.send(RECALL_QUEUE, {})
  logger.info('Worker laeuft – Recall-Job stuendlich geplant')
}

main().catch((err) => {
  logger.error({ err }, 'Worker konnte nicht starten')
  process.exit(1)
})
