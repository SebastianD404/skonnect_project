import { BackupStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { createSystemBackupSignedUrl } from "@/lib/data-backup-storage";
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
    const backup = await prisma.backupLog.findUnique({
      where: { id },
      select: {
        fileName: true,
        storagePath: true,
        status: true,
      },
    });
    if (!backup || backup.status !== BackupStatus.COMPLETED || !backup.storagePath) {
      return NextResponse.json({ error: "Stored backup file was not found." }, { status: 404 });
    }

    const signedUrl = await createSystemBackupSignedUrl(backup.storagePath, backup.fileName);
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error("System backup download failed:", error);
    return NextResponse.json({ error: "Unable to download the system backup." }, { status: 500 });
  }
}
