import { timingSafeEqual } from "node:crypto";
import { BackupStatus, BackupTrigger } from "@prisma/client";
import { NextResponse } from "next/server";
import { generateSystemBackupSnapshot } from "@/lib/data-backup";
import { getPhtDayBounds } from "@/lib/data-backup-schedule";
import { prisma } from "@/lib/prisma";
import { getSystemBackupAdmin } from "@/lib/system-backup-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type CompletedBackupSummary = {
  fileName: string;
  fileSizeBytes: number;
  checksumSha256: string;
  createdAt: Date;
  recordCounts: unknown;
};

function hasValidCronAuthorization(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function getErrorReason(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Unknown backup error.";
}

async function handleBackupRequest(request: Request) {
  const isCronRequest =
    request.method === "GET" && hasValidCronAuthorization(request);
  let actorId: string | null = null;

  if (!isCronRequest) {
    if (request.method !== "POST") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const auth = await getSystemBackupAdmin();
    if ("response" in auth) {
      return auth.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    actorId = auth.admin.id;
  }

  try {
    if (isCronRequest) {
      const { start, end } = getPhtDayBounds(new Date());
      let completedAutomatedBackup: CompletedBackupSummary | null;
      try {
        completedAutomatedBackup = await prisma.backupLog.findFirst({
          where: {
            trigger: { in: [BackupTrigger.AUTOMATED, BackupTrigger.SCHEDULED] },
            status: BackupStatus.COMPLETED,
            createdAt: { gte: start, lt: end },
          },
          orderBy: { createdAt: "desc" },
          select: {
            fileName: true,
            fileSizeBytes: true,
            checksumSha256: true,
            createdAt: true,
            recordCounts: true,
          },
        });
      } catch (error) {
        console.error("Could not query the AUTOMATED backup type; trying legacy scheduled logs.", error);
        completedAutomatedBackup = await prisma.backupLog.findFirst({
          where: {
            trigger: BackupTrigger.SCHEDULED,
            status: BackupStatus.COMPLETED,
            createdAt: { gte: start, lt: end },
          },
          orderBy: { createdAt: "desc" },
          select: {
            fileName: true,
            fileSizeBytes: true,
            checksumSha256: true,
            createdAt: true,
            recordCounts: true,
          },
        });
      }

      if (completedAutomatedBackup) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          fileName: completedAutomatedBackup.fileName,
          recordCounts: completedAutomatedBackup.recordCounts,
          fileSizeBytes: completedAutomatedBackup.fileSizeBytes,
          checksumSha256: completedAutomatedBackup.checksumSha256,
          createdAt: completedAutomatedBackup.createdAt,
        });
      }
    }

    const backup = await generateSystemBackupSnapshot({
      actorId,
      trigger: "AUTOMATED",
    });
    return NextResponse.json({
      ok: true,
      fileName: backup.fileName,
      recordCounts: backup.log.recordCounts,
      fileSizeBytes: backup.log.fileSizeBytes,
      checksumSha256: backup.log.checksumSha256,
      createdAt: backup.log.createdAt,
    });
  } catch (error) {
    console.error("Automated system backup failed:", error);
    const reason = getErrorReason(error);
    return NextResponse.json(
      { error: `Automated backup failed: ${reason}` },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleBackupRequest(request);
}

export async function POST(request: Request) {
  return handleBackupRequest(request);
}
