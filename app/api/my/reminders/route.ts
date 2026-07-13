import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/auth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ reminders: [] });
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return NextResponse.json({ reminders: [] });
  }

  const reminders = await prisma.reminderLog.findMany({
    where: { userId: appUser.id },
    orderBy: { sentAt: "desc" },
    take: 10,
    select: {
      id: true,
      reminderType: true,
      targetType: true,
      targetId: true,
      triggerDate: true,
      channel: true,
      sentAt: true,
      success: true,
      metadata: true,
    },
  });

  return NextResponse.json({ reminders });
}
