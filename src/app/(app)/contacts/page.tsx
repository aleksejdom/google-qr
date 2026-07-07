import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { deleteContact } from '@/server/contact-actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ContactForm,
  CsvImportForm,
  RequestConsentButton,
  CopyReviewLinkButton,
} from './contact-forms'
import { Trash2, Download, FileJson } from 'lucide-react'

export default async function ContactsPage() {
  const session = await requireSession()
  const contacts = await prisma.contact.findMany({
    where: { orgId: session.orgId },
    include: { _count: { select: { requests: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Kontakte</h1>
          <p className="text-sm text-zinc-500">
            Kontakte fuer Bewertungsanfragen – mit CSV-Import, Export und DSGVO-Funktionen.
          </p>
        </div>
        <a href="/api/export/contacts">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" /> CSV-Export
          </Button>
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Einwilligung</TableHead>
                    <TableHead>Anfragen</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-zinc-500">
                        Noch keine Kontakte – rechts anlegen oder CSV importieren.
                      </TableCell>
                    </TableRow>
                  )}
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.firstName} {contact.lastName ?? ''}
                      </TableCell>
                      <TableCell className="text-zinc-500">{contact.email ?? '–'}</TableCell>
                      <TableCell>
                        {contact.optedOutAt ? (
                          <Badge variant="destructive">Opt-out</Badge>
                        ) : (
                          <Badge variant="success">Aktiv</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.consentConfirmedAt ? (
                          <Badge variant="success" title={`Bestaetigt am ${format(contact.consentConfirmedAt, 'dd.MM.yyyy')} (Double-Opt-in)`}>
                            Bestaetigt
                          </Badge>
                        ) : contact.consentAt ? (
                          <Badge variant="secondary" title={`Erfasst am ${format(contact.consentAt, 'dd.MM.yyyy')}`}>
                            Erfasst
                          </Badge>
                        ) : (
                          <Badge variant="warning">Fehlt</Badge>
                        )}
                      </TableCell>
                      <TableCell>{contact._count.requests}</TableCell>
                      <TableCell className="text-zinc-500">
                        {format(contact.createdAt, 'dd.MM.yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {!contact.optedOutAt && <CopyReviewLinkButton contactId={contact.id} />}
                          {contact.email && !contact.consentConfirmedAt && !contact.optedOutAt && (
                            <RequestConsentButton contactId={contact.id} />
                          )}
                          <a
                            href={`/api/export/contact/${contact.id}`}
                            title="DSGVO-Datenexport (JSON)"
                          >
                            <Button variant="ghost" size="icon">
                              <FileJson className="h-4 w-4 text-zinc-400" />
                            </Button>
                          </a>
                          <form action={deleteContact.bind(null, contact.id)}>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Kontakt endgueltig loeschen (DSGVO)"
                            >
                              <Trash2 className="h-4 w-4 text-zinc-400" />
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Neuer Kontakt</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>CSV-Import</CardTitle>
              <CardDescription>
                Spalten: vorname, nachname, email, telefon, einwilligung (ja/nein) – Kopfzeile
                erforderlich
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CsvImportForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
