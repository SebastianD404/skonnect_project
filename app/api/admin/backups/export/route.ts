import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit/logger";
import { createSystemBackupSnapshot } from "@/lib/backup/snapshot";
import { getSystemBackupAdmin } from "@/lib/system-backup-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const auth = await getSystemBackupAdmin();
    if ("response" in auth) return auth.response;

    const backup = await createSystemBackupSnapshot({
      type: "MANUAL",
      createdBy: "Super Admin",
      createdById: auth.admin.id,
    });
    await writeAuditLog(prisma, {
      action: "SYSTEM_BACKUP_CREATED",
      actorId: auth.admin.id,
      targetTable: "backup_logs",
      targetId: backup.log.id,
      afterData: {
        fileName: backup.fileName,
        trigger: backup.log.trigger,
        fileSizeBytes: backup.log.fileSizeBytes,
        checksumSha256: backup.log.checksumSha256,
        storagePath: backup.log.storagePath,
      },
      metadata: {
        backupType: "MANUAL",
        recordCounts: backup.log.recordCounts,
      },
    });
    return new Response(backup.jsonString, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${backup.fileName}"`,
        "Content-Length": String(Buffer.byteLength(backup.jsonString, "utf8")),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Backup-Checksum-SHA256": backup.log.checksumSha256,
      },
    });
  } catch (error) {
    console.error("Manual system backup failed:", error);
    const reason = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Unable to generate a system backup: ${reason}` },
      { status: 500 },
    );
  }
}
