import { NextResponse } from "next/server";
import { generateSystemBackupSnapshot } from "@/lib/data-backup";
import { getSystemBackupAdmin } from "@/lib/system-backup-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const auth = await getSystemBackupAdmin();
    if ("response" in auth) return auth.response;

    const backup = await generateSystemBackupSnapshot({
      actorId: auth.admin.id,
      trigger: "MANUAL",
    });
    return new Response(backup.jsonString, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${backup.fileName}"`,
        "Content-Length": String(Buffer.byteLength(backup.jsonString, "utf8")),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Backup-Checksum-SHA256": backup.log.checksumSha256,
      },
    });
  } catch (error) {
    console.error("Manual system backup failed:", error);
    return NextResponse.json({ error: "Unable to generate a system backup." }, { status: 500 });
  }
}
