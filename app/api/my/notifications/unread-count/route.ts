import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const db = prisma;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 }, { status: 401 });

  const appUser = await ensureProfile(user);
  if (!appUser) return NextResponse.json({ count: 0 }, { status: 401 });

  const unreadCount = await db.notification.count({
    where: { userId: appUser.id, isRead: false },
  });

  return NextResponse.json({ count: unreadCount });
}
