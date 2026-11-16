import { BackupStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSystemBackupAdmin } from "@/lib/system-backup-auth";
import { prisma } from "@/lib/prisma";
import { getLiveBackupRecordCounts } from "@/lib/data-backup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getSystemBackupAdmin();
    if ("response" in auth) return auth.response;

    const [recentBackups, lastSuccessfulBackup, liveRecordCounts] = await Promise.all([
      prisma.backupLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { fullName: true } } },
      }),
      prisma.backupLog.findFirst({
        where: { status: BackupStatus.COMPLETED },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      getLiveBackupRecordCounts(),
    ]);

    return NextResponse.json({
      serverNow: new Date().toISOString(),
      recentBackups: recentBackups.map((log) => ({
        id: log.id,
        fileName: log.fileName,
        trigger: log.trigger,
        status: log.status,
        recordCounts: log.recordCounts,
        fileSizeBytes: log.fileSizeBytes,
        checksumSha256: log.checksumSha256,
        createdAt: log.createdAt,
        createdBy: log.createdBy?.fullName ?? null,
      })),
      lastSuccessfulBackupAt: lastSuccessfulBackup?.createdAt ?? null,
      liveRecordCounts,
    });
  } catch (error) {
    console.error("Failed to load backup history:", error);
    return NextResponse.json({ error: "Unable to load backup history." }, { status: 500 });
  }
}
