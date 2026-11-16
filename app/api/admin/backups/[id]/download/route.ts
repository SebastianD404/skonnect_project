import { BackupStatus, BackupTrigger, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { downloadScheduledBackup } from "@/lib/data-backup-storage";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await ensureProfile(user);
    if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const log = await prisma.backupLog.findUnique({
      where: { id },
      select: { fileName: true, trigger: true, status: true },
    });
    if (
      !log ||
      log.trigger !== BackupTrigger.SCHEDULED ||
      log.status !== BackupStatus.COMPLETED
    ) {
      return NextResponse.json({ error: "Scheduled backup file was not found." }, { status: 404 });
    }

    const file = await downloadScheduledBackup(log.fileName);
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
