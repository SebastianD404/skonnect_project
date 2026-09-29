import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { getSkeapWaitlistSnapshot } from "@/lib/skeap-waitlist";

async function authorizeAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user: appUser };
}

export async function GET() {
  try {
    const auth = await authorizeAdmin();
    if ("error" in auth) return auth.error;

    return NextResponse.json(await getSkeapWaitlistSnapshot());
  } catch (error) {
    console.error("Failed to load SKEAP waitlist:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load SKEAP waitlist." },
      { status: 500 }
    );
  }
}