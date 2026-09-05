import { prisma } from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { createGmailTransporter, sendBroadcastEmail } from "@/lib/broadcast-email";

const db = prisma;

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user from database
    const appUser = await ensureProfile(user);

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is SK_OFFICIAL or SUPER_ADMIN
    if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SK officials can create announcements" },
        { status: 403 }
      );
    }

    // Parse request body
    const { title, content, imageUrl } = await req.json();

    // Validate input
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }
    const transporter = createGmailTransporter();

    const announcement = await db.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          title: title.trim(),
          content: content.trim(),
          imageUrl: imageUrl || null,
          authorId: appUser.id,
          isPublished: true,
          publishedAt: new Date(),
        },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      await writeAuditLog(tx, {
        action: "CREATE_ANNOUNCEMENT",
        actorId: appUser.id,
        targetTable: "announcements",
        targetId: created.id,
        beforeData: null,
        afterData: {
          title: created.title,
          content: created.content,
          imageUrl: created.imageUrl,
        },
        metadata: {
          target: created.title,
          targetId: created.id,
        },
      });

      return created;
    });

    const grantees = await db.user.findMany({
      where: { role: "GRANTEE", isActive: true },
      select: { id: true, email: true },
    });
    await db.granteeMessage.createMany({
      data: grantees.map((grantee) => ({
        userId: grantee.id,
        senderId: appUser.id,
        subject: title.trim(),
        body: content.trim(),
      })),
    });
    await Promise.allSettled(
      grantees.map((grantee) => sendBroadcastEmail(transporter, grantee.email, title.trim(), content.trim()))
    );

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to create announcement:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to create announcement", details: errorMessage },
      { status: 500 }
    );
  }
}
