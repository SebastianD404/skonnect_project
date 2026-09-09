import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const db = prisma;

async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return ensureProfile(user);
}

export async function GET() {
  const appUser = await getCurrentUser();
  if (!appUser) return NextResponse.json({ notificationIds: [] }, { status: 401 });

  const notifications = await db.notification.findMany({
    where: { userId: appUser.id, isRead: true },
    orderBy: { createdAt: "desc" },
    select: { sourceKey: true },
  });
  const notificationIds = notifications.map((notification) => notification.sourceKey);

  return NextResponse.json({ notificationIds });
}

export async function POST(request: Request) {
  const appUser = await getCurrentUser();
  if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const sourceKey = typeof body?.notificationId === "string"
    ? body.notificationId.trim()
    : typeof body?.sourceKey === "string"
      ? body.sourceKey.trim()
      : "";
  if (!sourceKey || sourceKey.length > 300) {
    return NextResponse.json({ error: "A valid notification source key is required" }, { status: 400 });
  }

  await db.notification.upsert({
    where: { userId_sourceKey: { userId: appUser.id, sourceKey } },
    update: { isRead: true, readAt: new Date() },
    create: { userId: appUser.id, sourceKey, isRead: true, readAt: new Date() },
  });

  return NextResponse.json({ ok: true, notificationId: sourceKey });
}
