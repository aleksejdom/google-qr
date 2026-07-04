import nodemailer from 'nodemailer'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user?: string
  pass?: string
  from: string
}

/** SMTP-Konfiguration: Organisations-Einstellungen haben Vorrang, sonst ENV-Fallback. */
export async function getSmtpConfig(orgId: string): Promise<SmtpConfig | null> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (org?.smtpHost) {
    return {
      host: org.smtpHost,
      port: org.smtpPort ?? 587,
      secure: (org.smtpPort ?? 587) === 465,
      user: org.smtpUser ?? undefined,
      pass: org.smtpPass ?? undefined,
      from: org.smtpFrom ?? org.smtpUser ?? 'noreply@example.com',
    }
  }
  if (process.env.SMTP_HOST) {
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure:
        process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT ?? 587) === 465,
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@example.com',
    }
  }
  return null
}

export async function sendMail(opts: {
  orgId: string
  to: string
  subject: string
  text: string
}): Promise<{ ok: boolean; error?: string }> {
  const config = await getSmtpConfig(opts.orgId)
  if (!config) return { ok: false, error: 'Kein SMTP konfiguriert' }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  })

  try {
    await transporter.sendMail({
      from: config.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    })
    return { ok: true }
  } catch (err) {
    logger.error({ err, to: opts.to }, 'E-Mail-Versand fehlgeschlagen')
    return { ok: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' }
  }
}

/** Platzhalter wie {{vorname}} in Vorlagen ersetzen. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}
