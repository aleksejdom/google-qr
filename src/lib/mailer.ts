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

/** Versehentliche Leerzeichen (Copy-Paste) entfernen */
const clean = (v: string | null | undefined) => v?.trim() || undefined

/** SMTP-Konfiguration: Organisations-Einstellungen haben Vorrang, sonst ENV-Fallback. */
export async function getSmtpConfig(orgId: string): Promise<SmtpConfig | null> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (clean(org?.smtpHost)) {
    return {
      host: clean(org!.smtpHost)!,
      port: org!.smtpPort ?? 587,
      secure: (org!.smtpPort ?? 587) === 465,
      user: clean(org!.smtpUser),
      pass: org!.smtpPass ?? undefined,
      from: clean(org!.smtpFrom) ?? clean(org!.smtpUser) ?? 'noreply@example.com',
    }
  }
  if (clean(process.env.SMTP_HOST)) {
    return {
      host: clean(process.env.SMTP_HOST)!,
      port: Number(clean(process.env.SMTP_PORT) ?? 587),
      secure:
        clean(process.env.SMTP_SECURE) === 'true' ||
        Number(clean(process.env.SMTP_PORT) ?? 587) === 465,
      user: clean(process.env.SMTP_USER),
      pass: process.env.SMTP_PASS?.trim() || undefined,
      from: process.env.SMTP_FROM?.trim() || clean(process.env.SMTP_USER) || 'noreply@example.com',
    }
  }
  return null
}

type MailMessage = {
  to: string
  subject: string
  text: string
  html?: string
  /**
   * Abmelde-URL fuer die List-Unsubscribe-Header (RFC 8058, One-Click).
   * Gmail/Yahoo verlangen diese Header bei Massen-Versand – ohne sie
   * landen Kampagnen-Mails deutlich haeufiger im Spam.
   */
  unsubscribeUrl?: string
}

export type Mailer = {
  send(msg: MailMessage): Promise<{ ok: boolean; error?: string }>
  close(): void
}

/**
 * Mailer mit Verbindungs-Pool fuer den Kampagnen-Versand: eine SMTP-Sitzung
 * fuer viele Mails (statt Verbindung pro Mail) und gedrosseltes Tempo –
 * beides wichtig, damit der Provider den Versand nicht als Spam einstuft.
 */
export async function createMailer(
  orgId: string,
  opts?: { fromName?: string }
): Promise<Mailer | null> {
  const config = await getSmtpConfig(orgId)
  if (!config) return null

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    // Auf 587 & Co. Verschluesselung via STARTTLS erzwingen
    requireTLS: !config.secure,
    // Knappe Timeouts, damit der Nutzer schnell eine Fehlermeldung sieht,
    // statt dass die Aktion minutenlang haengt
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    // Pool + Drosselung: max. 5 Mails/Sekunde ueber max. 2 Verbindungen
    pool: true,
    maxConnections: 2,
    rateDelta: 1000,
    rateLimit: 5,
  })

  // Absender mit Anzeigename ("Firma <adresse>") wirkt vertrauenswuerdiger,
  // sofern in den Einstellungen nicht schon ein Name hinterlegt ist
  const from =
    opts?.fromName && !config.from.includes('<')
      ? { name: opts.fromName, address: config.from }
      : config.from

  return {
    async send(msg) {
      try {
        await transporter.sendMail({
          from,
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          // Immer multipart (Text + HTML) senden – reine Auffaelligkeiten
          // im Format erhoehen den Spam-Score
          html: msg.html ?? renderEmailHtml(msg.text),
          headers: msg.unsubscribeUrl
            ? {
                'List-Unsubscribe': `<${msg.unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              }
            : undefined,
        })
        return { ok: true }
      } catch (err) {
        logger.error({ err, to: msg.to }, 'E-Mail-Versand fehlgeschlagen')
        return { ok: false, error: err instanceof Error ? err.message : 'Unbekannter Fehler' }
      }
    },
    close() {
      transporter.close()
    },
  }
}

/** Einzelne E-Mail versenden (Verbindung wird danach geschlossen). */
export async function sendMail(
  opts: MailMessage & { orgId: string; fromName?: string }
): Promise<{ ok: boolean; error?: string }> {
  const mailer = await createMailer(opts.orgId, { fromName: opts.fromName })
  if (!mailer) return { ok: false, error: 'Kein SMTP konfiguriert' }
  try {
    return await mailer.send(opts)
  } finally {
    mailer.close()
  }
}

/** Platzhalter wie {{vorname}} in Vorlagen ersetzen. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * HTML-Variante einer E-Mail: optionaler Banner (max. 600px breit, klickbar)
 * ueber dem Text. Der Text wird escaped, Zeilenumbrueche werden zu <br>,
 * URLs zu Links.
 */
export function renderEmailHtml(text: string, banner?: { url: string; link?: string }): string {
  const body = escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563eb">$1</a>')
    .replace(/\n/g, '<br>\n')

  const img = banner
    ? `<img src="${banner.url}" alt="" width="600" style="width:100%;max-width:600px;height:auto;display:block;border:0;border-radius:8px" />`
    : ''
  const bannerHtml = banner
    ? banner.link
      ? `<a href="${escapeHtml(banner.link)}" target="_blank">${img}</a>`
      : img
    : ''

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5">
    <div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif">
      ${bannerHtml}
      <div style="padding:20px 0;font-size:15px;line-height:1.6;color:#27272a">
        ${body}
      </div>
    </div>
  </body>
</html>`
}
