import { Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function getOcrAdminActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { actor: null, error: "Unauthorized", status: 401 as const };

  const actor = await ensureProfile(user);
  if (!actor || (actor.role !== Role.SK_OFFICIAL && actor.role !== Role.SUPER_ADMIN)) {
    return { actor: null, error: "Forbidden", status: 403 as const };
  }

  return { actor, error: null, status: null };
}
