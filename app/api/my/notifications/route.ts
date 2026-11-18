import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { databaseUnavailableResponse } from "@/lib/database-errors";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });

    const appUser = await ensureProfile(user);
    if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });

    const [notifications, readNotifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: appUser.id, message: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          sourceKey: true,
          message: true,
          isRead: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.findMany({
        where: { userId: appUser.id, isRead: true },
        select: { sourceKey: true },
      }),
      prisma.notification.count({
        where: { userId: appUser.id, isRead: false },
      }),
    ]);

    return NextResponse.json({
      unreadCount,
      readIds: readNotifications.map((notification) => notification.sourceKey),
      notifications: notifications.map((notification) => ({
        id: notification.sourceKey,
        text: notification.message ?? "",
        isRead: notification.isRead,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        href: notification.sourceKey.startsWith("requirements-upload:") ||
            notification.sourceKey.startsWith("submission:")
          ? "/grantee-dashboard/documents"
          : notification.sourceKey.startsWith("skeap-grantee-approval:")
            ? "/"
          : notification.sourceKey.startsWith("skeap-physical-ctc:")
            ? "/applications"
          : notification.sourceKey.startsWith("kk-age-out:") ||
              notification.sourceKey.startsWith("kk-profile-archived:")
            ? "/programs/kk-profiling/status"
          : notification.sourceKey.startsWith("graduation-candidate-ready:") ||
              notification.sourceKey.startsWith("graduation-exit-clearance:")
            ? "/grantee-dashboard"
          : undefined,
      })),
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const unavailable = databaseUnavailableResponse(error, "GET /api/my/notifications");
    if (unavailable) {
      unavailable.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);
      return unavailable;
    }
    throw error;
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const appUser = await ensureProfile(user);
    if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (body?.markAllRead === true || body?.action === "mark_all_read") {
      const unreadCount = await prisma.$transaction(async (transaction) => {
        await transaction.notification.updateMany({
          where: { userId: appUser.id, isRead: false },
          data: { isRead: true, readAt: new Date() },
        });
        return transaction.notification.count({
          where: { userId: appUser.id, isRead: false },
        });
      });
      return NextResponse.json(
        { success: true, unreadCount },
        { headers: NO_STORE_HEADERS },
      );
    }

    const sourceKey = typeof body?.id === "string" ? body.id.trim() : "";
    if (!sourceKey || sourceKey.length > 300) {
      return NextResponse.json({ error: "A valid notification id is required" }, { status: 400 });
    }

    const readAt = new Date();
    const result = await prisma.$transaction(async (transaction) => {
      const currentNotification = await transaction.notification.findUnique({
        where: { userId_sourceKey: { userId: appUser.id, sourceKey } },
        select: { message: true },
      });
      let linkedMessage: { id: string; subject: string; body: string } | null = null;
      const readIds = new Set([sourceKey]);
      const markGraduationCandidateRead = async (granteeId: string) => {
        const candidateSourceKey = `graduation-candidate-ready:${granteeId}`;
        readIds.add(candidateSourceKey);
        await transaction.notification.updateMany({
          where: { userId: appUser.id, sourceKey: candidateSourceKey },
          data: { isRead: true, readAt },
        });
      };

      if (sourceKey.startsWith("message:")) {
        linkedMessage = await transaction.granteeMessage.findFirst({
          where: { id: sourceKey.slice("message:".length), userId: appUser.id },
          select: { id: true, subject: true, body: true },
        });
      } else if (sourceKey.startsWith("graduation-exit-clearance:") && currentNotification?.message) {
        const [subject, ...bodyLines] = currentNotification.message.split(/\r?\n/);
        const body = bodyLines.join("\n").trim();
        if (subject && body) {
          linkedMessage = await transaction.granteeMessage.findFirst({
            where: { userId: appUser.id, subject, body },
            select: { id: true, subject: true, body: true },
          });
        }
      }

      await transaction.notification.upsert({
        where: { userId_sourceKey: { userId: appUser.id, sourceKey } },
        update: { isRead: true, readAt },
        create: { userId: appUser.id, sourceKey, isRead: true, readAt },
      });
      if (sourceKey.startsWith("graduation-exit-clearance:")) {
        await markGraduationCandidateRead(
          sourceKey.slice("graduation-exit-clearance:".length),
        );
      }

      if (linkedMessage) {
        const linkedSourceKey = `message:${linkedMessage.id}`;
        if (sourceKey.startsWith("message:")) {
          const canonicalNotifications = await transaction.notification.findMany({
            where: {
              userId: appUser.id,
              message: `${linkedMessage.subject}\n${linkedMessage.body}`,
            },
            select: { sourceKey: true },
          });
          canonicalNotifications.forEach((notification) => readIds.add(notification.sourceKey));
          await transaction.notification.updateMany({
            where: {
              userId: appUser.id,
              message: `${linkedMessage.subject}\n${linkedMessage.body}`,
            },
            data: { isRead: true, readAt },
          });
          const graduationNotification = canonicalNotifications.find((notification) =>
            notification.sourceKey.startsWith("graduation-exit-clearance:"),
          );
          if (graduationNotification) {
            await markGraduationCandidateRead(
              graduationNotification.sourceKey.slice("graduation-exit-clearance:".length),
            );
          } else if (linkedMessage.subject === "Congratulations, SKEAP Graduate! 🎓") {
            const grantee = await transaction.grantee.findFirst({
              where: { userId: appUser.id },
              select: { id: true },
            });
            if (grantee) await markGraduationCandidateRead(grantee.id);
          }
        } else {
          readIds.add(linkedSourceKey);
          await transaction.notification.upsert({
            where: {
              userId_sourceKey: { userId: appUser.id, sourceKey: linkedSourceKey },
            },
            update: { isRead: true, readAt },
            create: {
              userId: appUser.id,
              sourceKey: linkedSourceKey,
              isRead: true,
              readAt,
            },
          });
        }
      }

      return {
        unreadCount: await transaction.notification.count({
          where: { userId: appUser.id, isRead: false },
        }),
        readIds: [...readIds],
      };
    });

    return NextResponse.json({ success: true, ...result }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const unavailable = databaseUnavailableResponse(error, "PATCH /api/my/notifications");
    if (unavailable) return unavailable;
    throw error;
  }
}
