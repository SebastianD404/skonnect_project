import "server-only";

import { BackupStatus, BackupTrigger } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPhtDayBounds } from "@/lib/data-backup-schedule";
import { generateSystemBackupSnapshot } from "@/lib/data-backup";

export type SystemBackupType = "MANUAL" | "SCHEDULED";

export async function createSystemBackupSnapshot({
  type,
  createdBy,
  createdById = null,
}: {
  type: SystemBackupType;
  createdBy: string;
  createdById?: string | null;
}) {
  return generateSystemBackupSnapshot({
    actorId: createdById,
    trigger: type,
    createdByLabel: createdBy,
  });
}

export async function runScheduledBackupIdempotent(triggeredBy = "System Cron") {
  const { start, end } = getPhtDayBounds(new Date());
  const existing = await prisma.backupLog.findFirst({
    where: {
      trigger: BackupTrigger.SCHEDULED,
      status: BackupStatus.COMPLETED,
      createdAt: { gte: start, lt: end },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return { ok: true as const, skipped: true, record: existing };
  }

  const backup = await createSystemBackupSnapshot({
    type: "SCHEDULED",
    createdBy: triggeredBy,
  });
  return { ok: true as const, skipped: false, record: backup.log };
}
