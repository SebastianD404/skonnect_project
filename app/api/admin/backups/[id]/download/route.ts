import { BackupStatus, BackupTrigger } from "@prisma/client";
import { NextResponse } from "next/server";
import { downloadScheduledBackup } from "@/lib/data-backup-storage";
import { prisma } from "@/lib/prisma";
import { getSystemBackupAdmin } from "@/lib/system-backup-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getSystemBackupAdmin();
    if ("response" in auth) return auth.response;

    const { id } = await params;
    const log = await prisma.backupLog.findUnique({
      where: { id },
      select: { fileName: true, trigger: true, status: true, storagePath: true },
    });
    if (
      !log ||
      (log.trigger !== BackupTrigger.AUTOMATED &&
        log.trigger !== BackupTrigger.SCHEDULED) ||
      log.status !== BackupStatus.COMPLETED
    ) {
      return NextResponse.json({ error: "Stored automated backup file was not found." }, { status: 404 });
    }

    const file = await downloadScheduledBackup(log.fileName, log.storagePath);
    return new Response(file, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${log.fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Scheduled backup download failed:", error);
    return NextResponse.json({ error: "Unable to download the scheduled backup." }, { status: 500 });
  }
}
