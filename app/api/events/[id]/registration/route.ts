import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const appUser = await ensureProfile(user);
    if (!appUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Find the registration for this user and event
    const registration = await prisma.registration.findFirst({ where: { eventId: id, userId: appUser.id } });
    if (!registration) return NextResponse.json({ error: "Registration not found" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.registration.delete({ where: { id: registration.id } });
      await tx.event.update({ where: { id }, data: { filledSlots: { decrement: 1 } } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel registration";
    console.error("Failed to cancel registration:", message, error);
    return NextResponse.json({ error: "Failed to cancel registration", details: message }, { status: 500 });
  }
}
