import { format } from 'date-fns'
import { prisma } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TaskForm, TaskStatusButtons } from './task-controls'

const statusLabel: Record<string, { label: string; variant: 'warning' | 'secondary' | 'success' }> = {
  OPEN: { label: 'Offen', variant: 'warning' },
  IN_PROGRESS: { label: 'In Arbeit', variant: 'secondary' },
  DONE: { label: 'Erledigt', variant: 'success' },
}

export default async function TasksPage() {
  const session = await requireSession()
  const tasks = await prisma.task.findMany({
    where: { orgId: session.orgId },
    include: { feedback: { select: { rating: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Aufgaben</h1>
        <p className="text-sm text-zinc-500">
          Aufgaben aus negativem Feedback und manuell angelegte To-dos.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {tasks.length === 0 && (
            <Card>
              <CardContent className="p-6 text-sm text-zinc-500">Keine Aufgaben.</CardContent>
            </Card>
          )}
          {tasks.map((task) => {
            const status = statusLabel[task.status] ?? statusLabel.OPEN
            return (
              <Card key={task.id}>
                <CardContent className="p-5">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{task.title}</p>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  {task.description && (
                    <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{task.description}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-zinc-500">
                      {format(task.createdAt, 'dd.MM.yyyy')}
                      {task.feedback && ` · aus ${task.feedback.rating}★-Feedback`}
                    </p>
                    <TaskStatusButtons taskId={task.id} current={task.status} />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Neue Aufgabe</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
