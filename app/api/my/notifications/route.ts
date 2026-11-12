import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { databaseUnavailableResponse } from "@/lib/database-errors";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const appUser = await ensureProfile(user);
    if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const notifications = await prisma.notification.findMany({
      where: { userId: appUser.id, message: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        sourceKey: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        id: notification.sourceKey,
        text: notification.message ?? "",
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      })),
    });
  } catch (error) {
    const unavailable = databaseUnavailableResponse(error, "GET /api/my/notifications");
    if (unavailable) return unavailable;
    throw error;
  }
}
