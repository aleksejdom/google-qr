import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export type AppSession = {
  userId: string
  orgId: string
  orgName: string
  role: string
  email: string
  name: string
}

/** Session erzwingen – leitet ohne Login auf /login um. */
export async function requireSession(): Promise<AppSession> {
  const session = await auth()
  if (!session?.user?.orgId) redirect('/login')
  return {
    userId: session.user.id,
    orgId: session.user.orgId,
    orgName: session.user.orgName,
    role: session.user.role,
    email: session.user.email ?? '',
    name: session.user.name ?? '',
  }
}

export function assertAdmin(session: AppSession) {
  if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
    throw new Error('Keine Berechtigung')
  }
}
