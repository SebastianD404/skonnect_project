import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { generateSystemBackupSnapshot } from "@/lib/data-backup";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
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

    const backup = await generateSystemBackupSnapshot({
      actorId: admin.id,
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
