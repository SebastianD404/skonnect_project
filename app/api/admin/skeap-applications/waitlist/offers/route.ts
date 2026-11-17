import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dispatchWaitlistSlotOffers } from "@/lib/skeap-waitlist-offers";

export async function POST() {
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

  try {
    const result = await dispatchWaitlistSlotOffers();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Failed to dispatch SKEAP waitlist slot offers:", error);
    return NextResponse.json(
      { error: "Unable to notify eligible waitlisted applicants. Please try again." },
      { status: 500 },
    );
  }
}
