import { BackupStatus, BackupTrigger } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSystemBackupAdmin } from "@/lib/system-backup-auth";
import { prisma } from "@/lib/prisma";
import { getLiveBackupRecordCounts } from "@/lib/data-backup";
import {
  getPhtDayBounds,
  getPhtTime,
  isPhtTimeAtOrAfterBackupTarget,
} from "@/lib/data-backup-schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getSystemBackupAdmin();
    if ("response" in auth) {
      return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const { start: currentPhtDayStart, end: nextPhtMidnight } = getPhtDayBounds(now);
    const { hour: currentPhtHour, minute: currentPhtMinute } = getPhtTime(now);
    let recentBackups: Array<{
      id: string;
      fileName: string;
      trigger: BackupTrigger;
      status: BackupStatus;
      recordCounts: unknown;
      fileSizeBytes: number;
      checksumSha256: string;
      createdAt: Date;
      createdBy: { fullName: string | null } | null;
      createdByLabel: string | null;
      storagePath: string | null;
      errorMessage: string | null;
    }> = [];
    let lastSuccessfulBackupAt: Date | null = null;
    let todayScheduledBackups: Array<{ status: BackupStatus; createdAt: Date }> = [];
    let historyError: string | null = null;

    try {
      [recentBackups, lastSuccessfulBackupAt] = await Promise.all([
        prisma.backupLog.findMany({
          take: 30,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            fileName: true,
            trigger: true,
            status: true,
            recordCounts: true,
            fileSizeBytes: true,
            checksumSha256: true,
            createdAt: true,
            createdBy: { select: { fullName: true } },
            createdByLabel: true,
            storagePath: true,
            errorMessage: true,
          },
        }),
        prisma.backupLog.findFirst({
          where: { status: BackupStatus.COMPLETED },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }).then((backup) => backup?.createdAt ?? null),
      ]);

      todayScheduledBackups = await prisma.backupLog.findMany({
          where: {
            trigger: BackupTrigger.SCHEDULED,
            createdAt: { gte: currentPhtDayStart, lt: nextPhtMidnight },
          },
          orderBy: { createdAt: "desc" },
          select: { status: true, createdAt: true },
        });
    } catch (error) {
      console.error("Failed to load backup history:", error);
      historyError = "Unable to load backup history.";
    }

    let liveRecordCounts: Awaited<ReturnType<typeof getLiveBackupRecordCounts>> | null = null;
    let countsError: string | null = null;
    try {
      liveRecordCounts = await getLiveBackupRecordCounts();
    } catch (error) {
      console.error("Failed to load protected record counts:", error);
      countsError = "Unable to load protected record counts.";
    }

    const successfulScheduledBackupToday = todayScheduledBackups.some(
      (backup) => backup.status === BackupStatus.COMPLETED,
    );
    const latestScheduledAttempt = todayScheduledBackups[0] ?? null;
    const schedulerStatus = historyError
      ? "UNKNOWN"
      : successfulScheduledBackupToday
        ? "HEALTHY"
        : !isPhtTimeAtOrAfterBackupTarget(currentPhtHour, currentPhtMinute)
          ? "NOT_DUE"
          : "MISSED";
    const schedulerNotice =
      schedulerStatus === "UNKNOWN"
        ? historyError
        : schedulerStatus !== "MISSED"
          ? null
          : latestScheduledAttempt?.status === BackupStatus.FAILED
            ? "Today's scheduled backup failed. Check the backup log for details."
            : "No successful scheduled backup is recorded for today's 12:00 AM PHT run.";

    return NextResponse.json({
      ...(historyError || countsError ? { error: historyError ?? countsError } : {}),
      serverNow: now.toISOString(),
      recentBackups: recentBackups.map((log) => ({
        id: log.id,
        fileName: log.fileName,
        trigger: log.trigger,
        type: log.trigger === BackupTrigger.MANUAL ? "MANUAL" : "SCHEDULED",
        status: log.status,
        recordCounts: log.recordCounts,
        fileSizeBytes: log.fileSizeBytes,
        checksumSha256: log.checksumSha256,
        createdAt: log.createdAt,
        storagePath: log.storagePath,
        errorMessage: log.errorMessage,
        downloadAvailable: log.status === BackupStatus.COMPLETED && Boolean(log.storagePath),
        createdBy: log.createdByLabel ??
          (log.trigger === BackupTrigger.MANUAL
            ? log.createdBy?.fullName ?? null
            : "System Cron"),
      })),
      lastSuccessfulBackupAt,
      schedulerStatus,
      schedulerNotice,
      currentPhtHour,
      currentPhtMinute,
      scheduledBackupToday: successfulScheduledBackupToday,
      liveRecordCounts,
    });
  } catch (error) {
    console.error("Backup overview request failed:", error);
    return NextResponse.json(
      { error: "Unable to load backup history." },
      { status: 500 },
    );
  }
}
