import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      orgId: string
      orgName: string
      role: string
    } & DefaultSession['user']
  }

  interface User {
    orgId: string
    orgName: string
    role: string
  }
}
