import { prisma } from '@/lib/db'

/** Audit-Log-Eintrag schreiben. Fehler hier duerfen die Hauptaktion nie blockieren. */
export async function logAudit(entry: {
  orgId?: string
  userId?: string
  action: string
  entity?: string
  entityId?: string
  meta?: Record<string, unknown>
}) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: entry.orgId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        meta: entry.meta as object | undefined,
      },
    })
  } catch {
    // bewusst verschluckt
  }
}
