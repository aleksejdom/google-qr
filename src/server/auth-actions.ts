'use server'

import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { AuthError } from 'next-auth'
import { prisma } from '@/lib/db'
import { signIn, signOut } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { slugify, randomCode } from '@/lib/utils'
import { redirect } from 'next/navigation'

const registerSchema = z.object({
  name: z.string().min(2, 'Name ist zu kurz'),
  orgName: z.string().min(2, 'Firmenname ist zu kurz'),
  email: z.string().email('Ungueltige E-Mail'),
  password: z.string().min(8, 'Passwort braucht mindestens 8 Zeichen'),
})

export type ActionState = { error?: string; success?: string }

export async function registerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    orgName: formData.get('orgName'),
    email: String(formData.get('email') ?? '').toLowerCase().trim(),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Eingaben pruefen' }
  }
  const { name, orgName, email, password } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: 'Diese E-Mail ist bereits registriert' }

  const passwordHash = await bcrypt.hash(password, 12)
  let slug = slugify(orgName) || 'org'
  if (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${slug}-${randomCode(4).toLowerCase()}`
  }

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      slug,
      memberships: {
        create: {
          role: 'OWNER',
          user: { create: { name, email, passwordHash } },
        },
      },
    },
  })

  await logAudit({ orgId: org.id, action: 'org.registered', entity: 'Organization', entityId: org.id })
  redirect('/login?registered=1')
}

export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await signIn('credentials', {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      redirectTo: '/dashboard',
    })
    return {}
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'E-Mail oder Passwort ist falsch' }
    }
    throw err // Redirects werden von Next.js als Exception geworfen
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: '/login' })
}
