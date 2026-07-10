import { optOutByToken } from '@/lib/opt-out'

export default async function OptOutPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const contact = await optOutByToken(token)

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-xl font-semibold">Abmeldung bestaetigt</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {contact
            ? 'Sie erhalten keine weiteren Bewertungsanfragen von uns.'
            : 'Dieser Abmeldelink ist ungueltig oder wurde bereits verwendet.'}
        </p>
      </div>
    </main>
  )
}
