import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const db = prisma;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await ensureProfile(user);
  if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { notificationIds?: unknown } | null;
  const notificationIds = Array.isArray(body?.notificationIds)
    ? body.notificationIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 300)
    : [];
  const readAt = new Date();

  await db.$transaction(async (transaction) => {
    if (notificationIds.length > 0) {
      await Promise.all(
        [...new Set(notificationIds)].map((sourceKey) =>
          transaction.notification.upsert({
            where: { userId_sourceKey: { userId: appUser.id, sourceKey } },
            update: { isRead: true, readAt },
            create: { userId: appUser.id, sourceKey, isRead: true, readAt },
          })
        )
      );
    }

    await transaction.notification.updateMany({
      where: {
        userId: appUser.id,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt,
      },
    });
  });

  return NextResponse.json({ ok: true, updated: notificationIds.length });
}
