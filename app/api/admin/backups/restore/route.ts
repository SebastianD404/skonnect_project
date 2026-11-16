import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import {
  BackupRestoreCommittedError,
  BackupSnapshotValidationError,
  parseAndVerifyBackupSnapshot,
  verifyAndRestoreBackupSnapshot,
} from "@/lib/data-backup";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_BACKUP_FILE_BYTES = 100 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_BACKUP_FILE_BYTES + 1024 * 1024;

async function getSystemAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = await ensureProfile(user);
  if (!admin || admin.role !== Role.SUPER_ADMIN) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin };
}

export async function POST(request: Request) {
  const auth = await getSystemAdmin();
  if ("response" in auth) return auth.response;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MULTIPART_BYTES) {
    return NextResponse.json({ error: "Backup file exceeds the 100 MB upload limit." }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const intent = formData.get("intent");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".json")) {
      return NextResponse.json({ error: "Select a valid .json backup file." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_BACKUP_FILE_BYTES) {
      return NextResponse.json({ error: "Backup file must be between 1 byte and 100 MB." }, { status: 413 });
    }

    const rawContent = await file.text();
    if (intent === "verify") {
      const snapshot = parseAndVerifyBackupSnapshot(rawContent);
      return NextResponse.json({
        checksumVerified: true,
        checksumSha256: snapshot.checksumSha256,
        fileName: file.name,
        recordCounts: snapshot.meta.recordCounts,
        createdAt: snapshot.meta.createdAt,
      });
    }

    if (intent !== "restore" || formData.get("confirmation") !== "RESTORE") {
      return NextResponse.json(
        { error: 'Type "RESTORE" to confirm the database restore.' },
        { status: 400 },
      );
    }

    const result = await verifyAndRestoreBackupSnapshot({
      rawContent,
      actorId: auth.admin.id,
    });
    return NextResponse.json({
      success: true,
      restoredCounts: result.restoredCounts,
      checksumSha256: result.checksumSha256,
    });
  } catch (error) {
    if (error instanceof BackupSnapshotValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof BackupRestoreCommittedError) {
      return NextResponse.json(
        {
          error: "Backup data was restored, but admin views could not be refreshed. Do not retry the restore; contact a System Admin.",
        },
        { status: 503 },
      );
    }
    console.error("System backup verification or restore failed:", error);
    return NextResponse.json({ error: "Unable to verify or restore this backup file." }, { status: 500 });
  }
}
