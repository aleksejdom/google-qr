# ReviewPilot

Mandantenfähige, selbst gehostete Review-Management-SaaS: Bewertungslinks, QR-Codes,
E-Mail-Kampagnen, Recall-Erinnerungen, internes Feedback und Aufgaben – **ausschließlich
mit kostenlosen Open-Source-Bibliotheken**, ohne Pflicht-SaaS-Dienste.

## Tech-Stack (100 % kostenlos / Open Source)

| Bereich | Bibliothek |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions), TypeScript |
| Datenbank | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Auth.js / NextAuth v5 (Credentials, JWT), bcryptjs |
| UI | Tailwind CSS 4, shadcn-Stil-Komponenten, lucide-react |
| Charts | Recharts |
| QR-Codes | `qrcode` + `sharp` (Logo-Einbettung) |
| PDF | `pdf-lib` (A4-Poster für den Aushang) |
| E-Mail | `nodemailer` über eigenen SMTP (pro Organisation konfigurierbar) |
| Background-Jobs | `pg-boss` (läuft auf derselben PostgreSQL) |
| CSV | `papaparse` (Import & Export) |
| Storage | lokales Dateisystem **oder** selbst gehostetes MinIO (S3-kompatibel) |
| Logging | `pino` + eigene Audit-Log-Tabelle |
| Validierung | `zod` |

## Funktionen (MVP)

- Registrierung → legt Organisation + Owner an (Multi-Tenant, Rollen OWNER/ADMIN/MEMBER)
- Standorte mit eigenem Bewertungs-Funnel (`/f/{slug}`) und Feedback-Schwelle
- Bewertungslinks (Google, Facebook, Trustpilot, eigene) mit Kurzlink `/r/{code}`
- Anonymes Scan-/Klick-Tracking (nur Zeitpunkt + Quelle, keine personenbezogenen Daten)
- QR-Code als PNG (`/api/qr/{code}`), optional mit Organisations-Logo, Poster-PDF (`/api/poster/{code}`)
- Kontakte mit CSV-Import, CSV-Export, DSGVO-Datenexport (JSON) und endgültiger Löschung
- E-Mail-Kampagnen mit Platzhaltern (`{{vorname}}`, `{{bewertungslink}}`, `{{abmeldelink}}` …)
- Bewertungs-Funnel: ab Schwellwert → externe Bewertung, darunter → internes Feedback
- Negatives Feedback erzeugt automatisch eine Aufgabe
- Recall-Regeln + Hintergrund-Worker (pg-boss) für Erinnerungs-E-Mails
- Opt-out-Link in jeder E-Mail
- Dashboard mit KPIs, Scan-Chart und Bewertungsverteilung
- Audit-Log der letzten Aktionen
- SMS/WhatsApp: kopierbare Vorlage + `wa.me`-Deep-Link (kein kostenpflichtiger Versand im MVP)

## Lokale Entwicklung

```bash
npm install                 # führt automatisch "prisma generate" aus
cp .env.example .env        # Werte eintragen (DATABASE_URL, AUTH_SECRET, SMTP, …)
npx prisma migrate dev      # Schema anlegen
npm run db:seed             # Demo-Daten (Login: admin@demo.de / demo1234)
npm run dev                 # App auf http://localhost:3000
npm run worker              # optional: Recall-Worker (eigenes Terminal)
```

## Umgebungsvariablen

Siehe `.env.example`. Wichtig:

- `DATABASE_URL` – PostgreSQL-Verbindung
- `AUTH_SECRET` – `openssl rand -base64 32`
- `APP_URL` – öffentliche Basis-URL (für QR-Codes, E-Mail-Links, Opt-out!)
- `SMTP_*` – Fallback-SMTP; kann pro Organisation in den Einstellungen überschrieben werden
- `STORAGE_DRIVER` – `local` oder `minio` (+ `S3_*`-Variablen)

## Deployment (Coolify / eigener Server)

Das mitgelieferte `Dockerfile` baut die App und führt beim Start automatisch
`prisma migrate deploy` aus.

1. Repo in Coolify als Anwendung anlegen (Build: Dockerfile)
2. Umgebungsvariablen setzen – als `DATABASE_URL` den **internen** Postgres-Host verwenden
3. `APP_URL` auf die öffentliche Domain setzen (sonst zeigen QR-Codes auf localhost!)
4. Optional zweiten Service aus demselben Image mit Kommando `npm run worker` für Recalls
5. Optional MinIO-Zugangsdaten setzen (`STORAGE_DRIVER=minio`), sonst `STORAGE_DRIVER=local`

## Projektstruktur (Auszug)

```
prisma/schema.prisma      Datenmodell (Orgs, Standorte, Links, Kampagnen, …)
src/lib/                  db, auth, mailer, storage (MinIO/local), audit, logger
src/server/               Server Actions (Auth, Standorte, Kontakte, Kampagnen, …)
src/app/(app)/            eingeloggte Bereiche (Dashboard, Standorte, Kampagnen, …)
src/app/f/[slug]/         öffentlicher Bewertungs-Funnel
src/app/r/[code]/         Kurzlink-Redirect mit anonymem Tracking
src/app/api/              QR-PNG, Poster-PDF, CSV-/DSGVO-Export, NextAuth
src/worker.ts             pg-boss Recall-Worker
```

## Bewusst NICHT enthalten (laut Anforderung)

Kein Clerk, Supabase, Resend, SendGrid, Twilio, Zapier, Inngest, keine kostenpflichtigen
KI-APIs, keine kommerziellen UI-Kits oder Chart-Libraries. Automatischer SMS-/WhatsApp-Versand
und die Google Business Profile API sind bewusst als spätere, optionale Module vorgesehen.
