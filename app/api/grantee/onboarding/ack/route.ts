import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await prisma.user.findFirst({
      where: {
        OR: [{ authId: user.id }, { email: user.email ?? "" }],
      },
      select: { id: true, role: true },
    });

    if (!appUser || appUser.role !== "GRANTEE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: appUser.id },
      data: { hasSeenOnboarding: true },
      select: { id: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update onboarding state";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
