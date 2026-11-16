import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { generateSystemBackupSnapshot } from "@/lib/data-backup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const backup = await generateSystemBackupSnapshot({
      actorId: null,
      trigger: "SCHEDULED",
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
    console.error("Scheduled system backup failed:", error);
    return NextResponse.json({ error: "Scheduled backup failed." }, { status: 500 });
  }
}
