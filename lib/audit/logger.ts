import { Prisma, PrismaClient } from "@prisma/client";

export type AuditLogClient = PrismaClient | Prisma.TransactionClient;

export type AuditLogInput = {
  action: string;
  actorId: string;
  targetTable: string;
  targetId: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
};

export async function writeAuditLog(client: AuditLogClient, input: AuditLogInput) {
  const metadata = input.metadata ?? null;
  const meta = input.meta ?? metadata ?? null;

  const data: Prisma.AuditLogCreateInput = {
    action: input.action,
    targetTable: input.targetTable,
    targetId: input.targetId,
    beforeData: (input.beforeData ?? null) as Prisma.InputJsonValue,
    afterData: (input.afterData ?? null) as Prisma.InputJsonValue,
    metadata: (metadata ?? null) as Prisma.InputJsonValue,
    actor: {
      connect: { id: input.actorId },
    },
  };

  return client.auditLog.create({ data });
}
