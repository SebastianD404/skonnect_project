import { BackupStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getLiveBackupRecordCounts } from "@/lib/data-backup";

export const dynamic = "force-dynamic";

async function getBackupAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return { error: "Forbidden", status: 403 as const };
  }
  return { admin };
}

export async function GET() {
  try {
    const auth = await getBackupAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

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
      canRestore: auth.admin.role === Role.SUPER_ADMIN,
    });
  } catch (error) {
    console.error("Failed to load backup history:", error);
    return NextResponse.json({ error: "Unable to load backup history." }, { status: 500 });
  }
}
