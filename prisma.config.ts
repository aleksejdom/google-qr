import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Fallback nur fuer "prisma generate" im Build (keine echte Verbindung noetig)
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/placeholder',
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
})
