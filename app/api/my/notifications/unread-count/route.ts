import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { databaseUnavailableResponse } from "@/lib/database-errors";

const db = prisma;

export async function GET() {
  try {
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
  } catch (error) {
    const unavailable = databaseUnavailableResponse(error, "GET /api/my/notifications/unread-count");
    if (unavailable) return unavailable;
    throw error;
  }
}
