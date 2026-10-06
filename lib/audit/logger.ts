import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
    meta: (meta ?? null) as Prisma.InputJsonValue,
    actor: {
      connect: { id: input.actorId },
    },
  };

  const auditLogClient = client as PrismaClient & { auditLog?: { create: (args: { data: Prisma.AuditLogCreateInput }) => Promise<unknown> } };
  return auditLogClient.auditLog!.create({ data });
}

export type AuditEventAction =
  | "APPLICATION_APPROVED"
  | "APPLICATION_REJECTED"
  | "APPLICATION_PROMOTED"
  | "DOCUMENT_OVERRIDDEN"
  | "DOCUMENT_REVIEWED"
  | "GRANTEE_STATUS_CHANGED"
  | "RECORDS_EXPORTED"
  | "INQUIRY_RESOLVED"
  | "INQUIRY_REOPENED";

export type AuditEventInput = {
  actorId: string;
  actorEmail?: string;
  action: AuditEventAction;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

export function logAuditEvent(input: AuditEventInput): void {
  const metadata = {
    ...input.metadata,
    ...(input.actorEmail ? { actorEmail: input.actorEmail } : {}),
  };

  void writeAuditLog(prisma, {
    action: input.action,
    actorId: input.actorId,
    targetTable: input.resource,
    targetId: input.resourceId ?? "bulk",
    metadata,
  }).catch((error: unknown) => {
    console.error("Failed to write audit event:", error);
  });
}
