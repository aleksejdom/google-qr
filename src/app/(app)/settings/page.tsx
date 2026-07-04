import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { toggleRecallRule, deleteRecallRule } from '@/server/settings-actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { OrgNameForm, SmtpForm, LogoForm, RecallRuleForm } from './settings-forms'

export default async function SettingsPage() {
  const session = await requireSession()
  const [org, recallRules, auditLogs] = await Promise.all([
    prisma.organization.findUnique({ where: { id: session.orgId } }),
    prisma.recallRule.findMany({ where: { orgId: session.orgId }, orderBy: { daysAfter: 'asc' } }),
    prisma.auditLog.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])
  if (!org) return null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="text-sm text-zinc-500">Organisation, E-Mail-Versand, Recall und Audit-Log.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organisation</CardTitle>
        </CardHeader>
        <CardContent>
          <OrgNameForm currentName={org.name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SMTP-Versand</CardTitle>
          <CardDescription>
            Eigener SMTP-Server pro Organisation. Leer lassen, um den Server-Standard (ENV) zu
            nutzen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SmtpForm
            defaults={{
              smtpHost: org.smtpHost ?? '',
              smtpPort: org.smtpPort ?? 587,
              smtpUser: org.smtpUser ?? '',
              smtpFrom: org.smtpFrom ?? '',
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo fuer QR-Codes</CardTitle>
          <CardDescription>PNG/JPG, max. 2 MB – wird mittig in QR-Codes eingebettet.</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recall-Regeln</CardTitle>
          <CardDescription>
            Automatische Erinnerungen fuer unbeantwortete Bewertungsanfragen (laufen ueber den
            Hintergrund-Worker).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recallRules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div>
                <p className="text-sm font-medium">{rule.name}</p>
                <p className="text-xs text-zinc-500">
                  nach {rule.daysAfter} Tagen, max. {rule.maxReminders} Erinnerung
                  {rule.maxReminders === 1 ? '' : 'en'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={rule.active ? 'success' : 'secondary'}>
                  {rule.active ? 'Aktiv' : 'Inaktiv'}
                </Badge>
                <form action={toggleRecallRule.bind(null, rule.id)}>
                  <Button variant="outline" size="sm">
                    {rule.active ? 'Deaktivieren' : 'Aktivieren'}
                  </Button>
                </form>
                <form action={deleteRecallRule.bind(null, rule.id)}>
                  <Button variant="ghost" size="sm">
                    Loeschen
                  </Button>
                </form>
              </div>
            </div>
          ))}
          <RecallRuleForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit-Log</CardTitle>
          <CardDescription>Die letzten 50 Aktionen in Ihrer Organisation.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeitpunkt</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Objekt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-zinc-500">
                    {format(log.createdAt, 'dd.MM.yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.action}</TableCell>
                  <TableCell className="text-zinc-500">{log.entity ?? '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
