import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
  const email = 'admin@demo.de'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Seed uebersprungen – Demo-Nutzer existiert bereits.')
    return
  }

  const passwordHash = await bcrypt.hash('demo1234', 12)

  const org = await prisma.organization.create({
    data: {
      name: 'Demo GmbH',
      slug: 'demo-gmbh',
      memberships: {
        create: {
          role: 'OWNER',
          user: { create: { name: 'Demo Admin', email, passwordHash } },
        },
      },
      locations: {
        create: {
          name: 'Filiale Berlin',
          slug: 'filiale-berlin',
          address: 'Musterstr. 1, 10115 Berlin',
          feedbackThreshold: 4,
          reviewLinks: {
            create: {
              platform: 'GOOGLE',
              label: 'Google',
              targetUrl: 'https://www.google.com/maps',
              code: 'demo123',
            },
          },
        },
      },
      recallRules: {
        create: { name: 'Standard-Erinnerung', daysAfter: 3, maxReminders: 1 },
      },
      contacts: {
        create: [
          { firstName: 'Anna', lastName: 'Beispiel', email: 'anna@example.com' },
          { firstName: 'Ben', lastName: 'Muster', email: 'ben@example.com' },
        ],
      },
    },
  })

  console.log(`Seed fertig. Login: ${email} / demo1234 (Organisation: ${org.name})`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
