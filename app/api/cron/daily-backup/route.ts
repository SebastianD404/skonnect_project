import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runScheduledBackupIdempotent } from "@/lib/backup/snapshot";
import { getSystemBackupAdmin } from "@/lib/system-backup-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function hasValidCronAuthorization(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

async function handleDailyBackup(request: Request) {
  try {
    if (!hasValidCronAuthorization(request)) {
      const auth = await getSystemBackupAdmin();
      if ("response" in auth) return auth.response;
    }

    const result = await runScheduledBackupIdempotent("System Cron");
    return NextResponse.json({
      ok: true,
      skipped: result.skipped,
      message: result.skipped
        ? "Today's scheduled backup already exists."
        : "Today's scheduled backup completed.",
      record: result.record,
    });
  } catch (error) {
    console.error("Daily system backup failed:", error);
    const message = error instanceof Error ? error.message : "Unknown backup error.";
    return NextResponse.json(
      { ok: false, error: `Daily backup failed: ${message}` },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleDailyBackup(request);
}

export async function POST(request: Request) {
  return handleDailyBackup(request);
}
