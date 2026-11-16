import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const SYSTEM_BACKUP_FORBIDDEN_MESSAGE =
  "Only System Administrators can access system backups and recovery.";

export async function getSystemBackupAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = await ensureProfile(user);
  if (!admin || admin.role !== Role.SUPER_ADMIN) {
    return {
      response: NextResponse.json(
        { error: SYSTEM_BACKUP_FORBIDDEN_MESSAGE },
        { status: 403 },
      ),
    };
  }

  return { admin };
}
