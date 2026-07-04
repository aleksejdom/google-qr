export const DEFAULT_EMAIL_SUBJECT = 'Wie zufrieden waren Sie mit uns, {{vorname}}?'

export const DEFAULT_EMAIL_BODY = `Hallo {{vorname}},

vielen Dank fuer Ihren Besuch! Ihre Meinung ist uns wichtig.
Wuerden Sie sich kurz Zeit nehmen und uns bewerten?

{{bewertungslink}}

Vielen Dank!
{{firma}}

--
Keine weiteren E-Mails erhalten: {{abmeldelink}}`

export const REMINDER_EMAIL_SUBJECT = 'Kurze Erinnerung: Ihre Meinung zaehlt, {{vorname}}'

export const REMINDER_EMAIL_BODY = `Hallo {{vorname}},

vor ein paar Tagen hatten wir Sie um eine Bewertung gebeten.
Falls Sie noch keine Zeit hatten – hier ist der Link:

{{bewertungslink}}

Vielen Dank!
{{firma}}

--
Keine weiteren E-Mails erhalten: {{abmeldelink}}`

/** Kopierbare Vorlagen fuer SMS / WhatsApp (kein automatischer Versand im MVP) */
export const SMS_TEMPLATE =
  'Hallo {{vorname}}, danke fuer Ihren Besuch bei {{firma}}! Wir freuen uns ueber Ihre Bewertung: {{bewertungslink}}'
