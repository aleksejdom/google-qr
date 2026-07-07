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

export const CONSENT_EMAIL_SUBJECT = 'Duerfen wir Sie um Ihre Meinung bitten, {{vorname}}?'

export const CONSENT_EMAIL_BODY = `Hallo {{vorname}},

wir bei {{firma}} moechten Sie gelegentlich per E-Mail um eine kurze
Bewertung bitten. Dafuer benoetigen wir Ihre Einwilligung.

Mit einem Klick bestaetigen Sie, dass wir Ihnen Bewertungsanfragen
per E-Mail senden duerfen (jederzeit widerrufbar):

{{bestaetigungslink}}

Wenn Sie das nicht moechten, ignorieren Sie diese E-Mail einfach –
Sie erhalten dann keine Bewertungsanfragen von uns.

Vielen Dank!
{{firma}}

--
Keine weiteren E-Mails erhalten: {{abmeldelink}}`

/** DSGVO-Nachweis: hinterlegter Einwilligungstext je Erfassungsweg */
export const CONSENT_TEXT_MANUAL =
  'Einwilligung zum Erhalt von Bewertungsanfragen per E-Mail liegt vor (vom Betreiber bei der Erfassung bestaetigt).'

export const CONSENT_TEXT_FUNNEL =
  'Der Kontakt hat seine Daten selbst im Bewertungs-Funnel angegeben und dabei eingewilligt, Bewertungsanfragen per E-Mail zu erhalten. Die Einwilligung ist jederzeit ueber den Abmeldelink widerrufbar.'

export const CONSENT_TEXT_CONFIRMED =
  'Der Kontakt hat per Bestaetigungslink (Double-Opt-in) eingewilligt, Bewertungsanfragen per E-Mail zu erhalten. Die Einwilligung ist jederzeit ueber den Abmeldelink widerrufbar.'

/** Kopierbare Vorlagen fuer SMS / WhatsApp (kein automatischer Versand im MVP) */
export const SMS_TEMPLATE =
  'Hallo {{vorname}}, danke fuer Ihren Besuch bei {{firma}}! Wir freuen uns ueber Ihre Bewertung: {{bewertungslink}}'
