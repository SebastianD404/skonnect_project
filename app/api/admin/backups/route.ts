import { BackupStatus, BackupTrigger } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSystemBackupAdmin } from "@/lib/system-backup-auth";
import { prisma } from "@/lib/prisma";
import { getLiveBackupRecordCounts } from "@/lib/data-backup";
import { getPhtDayBounds } from "@/lib/data-backup-schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getSystemBackupAdmin();
    if ("response" in auth) {
      return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const { start: currentPhtDayStart, end: nextPhtMidnight } = getPhtDayBounds(now);
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
      errorMessage: string | null;
    }> = [];
    let lastSuccessfulBackupAt: Date | null = null;
    let todayAutomatedBackups: Array<{ status: BackupStatus; createdAt: Date }> = [];
    let historyError: string | null = null;

    try {
      [recentBackups, lastSuccessfulBackupAt] = await Promise.all([
        prisma.backupLog.findMany({
          take: 10,
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
            errorMessage: true,
          },
        }),
        prisma.backupLog.findFirst({
          where: { status: BackupStatus.COMPLETED },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }).then((backup) => backup?.createdAt ?? null),
      ]);

      try {
        todayAutomatedBackups = await prisma.backupLog.findMany({
          where: {
            trigger: { in: [BackupTrigger.AUTOMATED, BackupTrigger.SCHEDULED] },
            createdAt: { gte: currentPhtDayStart, lt: nextPhtMidnight },
          },
          orderBy: { createdAt: "desc" },
          select: { status: true, createdAt: true },
        });
      } catch (error) {
        console.error("Could not query the new automated backup type; trying legacy scheduled logs.", error);
        todayAutomatedBackups = await prisma.backupLog.findMany({
          where: {
            trigger: BackupTrigger.SCHEDULED,
            createdAt: { gte: currentPhtDayStart, lt: nextPhtMidnight },
          },
          orderBy: { createdAt: "desc" },
          select: { status: true, createdAt: true },
        });
      }
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

    const successfulAutomatedBackupToday = todayAutomatedBackups.some(
      (backup) => backup.status === BackupStatus.COMPLETED,
    );
    const latestAutomatedAttempt = todayAutomatedBackups[0] ?? null;
    const schedulerStatus = historyError
      ? "UNKNOWN"
      : successfulAutomatedBackupToday
        ? "HEALTHY"
        : now < currentPhtDayStart
          ? "NOT_DUE"
          : "MISSED";
    const schedulerNotice =
      schedulerStatus === "UNKNOWN"
        ? historyError
        : schedulerStatus !== "MISSED"
          ? null
          : latestAutomatedAttempt?.status === BackupStatus.FAILED
            ? "Today's automated backup failed (FAILED). Check the server backup log for details."
            : "No successful automated backup is recorded for today's 12:00 AM PHT run.";

    return NextResponse.json({
      ...(historyError || countsError ? { error: historyError ?? countsError } : {}),
      serverNow: now.toISOString(),
      recentBackups: recentBackups.map((log) => ({
        id: log.id,
        fileName: log.fileName,
        trigger: log.trigger,
        status: log.status,
        recordCounts: log.recordCounts,
        fileSizeBytes: log.fileSizeBytes,
        checksumSha256: log.checksumSha256,
        createdAt: log.createdAt,
        storagePath: null,
        errorMessage: log.errorMessage,
        downloadAvailable:
          log.status === BackupStatus.COMPLETED &&
          log.trigger !== BackupTrigger.MANUAL,
        createdBy:
          log.trigger !== BackupTrigger.MANUAL
            ? "System (Cron)"
            : log.createdBy?.fullName ?? null,
      })),
      lastSuccessfulBackupAt,
      schedulerStatus,
      schedulerNotice,
      nextScheduledAt: nextPhtMidnight.toISOString(),
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
