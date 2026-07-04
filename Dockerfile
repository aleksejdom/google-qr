# ReviewPilot – Next.js App (selbst gehostet, z. B. via Coolify/Hetzner)
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
# postinstall (prisma generate) erst nach dem Kopieren des Codes ausfuehren
RUN npm ci --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app ./
EXPOSE 3000
# Beim Start: Migrationen anwenden, dann Server starten.
# Fuer den Recall-Worker einen zweiten Container/Service mit CMD ["npm","run","worker"] starten.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
