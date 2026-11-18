import { NextResponse } from "next/server";
import { getSystemBackupAdmin } from "@/lib/system-backup-auth";
import {
  BackupRestoreCommittedError,
  BackupSnapshotValidationError,
  parseAndVerifyBackupSnapshot,
  verifyAndRestoreBackupSnapshot,
} from "@/lib/data-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BACKUP_FILE_BYTES = 100 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_BACKUP_FILE_BYTES + 1024 * 1024;

function getCleanPrismaRestoreError(error: unknown) {
  const details = error && typeof error === "object"
    ? error as { message?: unknown; code?: unknown; meta?: { modelName?: unknown; target?: unknown } }
    : null;
  const code = typeof details?.code === "string" && /^P\d{4}$/.test(details.code)
    ? details.code
    : null;
  const rawMessage = typeof details?.message === "string" ? details.message : "";
  const modelName = typeof details?.meta?.modelName === "string" &&
      /^[A-Za-z][A-Za-z0-9_]*$/.test(details.meta.modelName)
    ? details.meta.modelName
    : rawMessage.match(/\b(?:tx|prisma)\.([A-Za-z][A-Za-z0-9_]*)\.(?:create|createMany|update|updateMany|upsert)\b/i)?.[1]
      ?.replace(/^./, (letter) => letter.toUpperCase()) ?? null;
  const target = Array.isArray(details?.meta?.target)
    ? details.meta.target
        .filter((value): value is string => typeof value === "string" && /^[A-Za-z0-9_]+$/.test(value))
        .join(", ")
    : null;

  if (!code) {
    return {
      error: "Database restore failed. See server logs for details.",
      code: "RESTORE_FAILED",
    };
  }

  if (code === "P2028") {
    return {
      error: `Database restore failed (P2028): Transaction expired while syncing ${modelName ?? "database"} records.`,
      code: "PRISMA_P2028",
    };
  }

  const summary = code === "P2002"
    ? `A unique constraint conflicts with an existing record${target ? ` (${target})` : ""}.`
    : code === "P2003"
      ? "A related record is missing or violates a foreign-key constraint."
      : code === "P2025"
        ? "A required record was not found while applying the snapshot."
        : code === "P2000"
          ? "A value exceeds the database field's supported length."
          : "The database rejected a restore operation.";
  return {
    error: `Database restore failed (${code}${modelName ? `, ${modelName}` : ""}): ${summary}`,
    code: `PRISMA_${code}`,
  };
}

export async function POST(request: Request) {
  const auth = await getSystemBackupAdmin();
  if ("response" in auth) return auth.response;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MULTIPART_BYTES) {
    return NextResponse.json(
      { error: "Backup file exceeds the 100 MB upload limit.", code: "PAYLOAD_TOO_LARGE" },
      { status: 413 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const intent = formData.get("intent");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".json")) {
      return NextResponse.json(
        { error: "Select a valid .json backup file.", code: "INVALID_BACKUP_FILE" },
        { status: 400 },
      );
    }
    if (file.size === 0 || file.size > MAX_BACKUP_FILE_BYTES) {
      return NextResponse.json(
        { error: "Backup file must be between 1 byte and 100 MB.", code: "PAYLOAD_TOO_LARGE" },
        { status: 413 },
      );
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
        { error: 'Type "RESTORE" to confirm the database restore.', code: "RESTORE_CONFIRMATION_REQUIRED" },
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
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    if (error instanceof BackupRestoreCommittedError) {
      return NextResponse.json(
        {
          error: "Backup data was restored, but admin views could not be refreshed. Do not retry the restore; contact a System Admin.",
          code: "RESTORE_COMMITTED_VIEW_REFRESH_FAILED",
        },
        { status: 503 },
      );
    }
    console.error("System backup verification or restore failed:", {
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    const rawMessage = error instanceof Error ? error.message : String(error);
    if (/payload|request body|entity|upload/i.test(rawMessage) && /large|limit|exceed/i.test(rawMessage)) {
      return NextResponse.json(
        {
          error: "Backup upload exceeds the allowed payload size.",
          code: "PAYLOAD_TOO_LARGE",
        },
        { status: 413 },
      );
    }
    const diagnostic = getCleanPrismaRestoreError(error);
    return NextResponse.json(
      diagnostic,
      { status: 500 },
    );
  }
}
