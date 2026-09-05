import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGmailTransporter, sendBroadcastEmail } from "@/lib/broadcast-email";

const db = prisma;

type BroadcastPayload = {
  subject?: string;
  body?: string;
  audienceType?: "ALL" | "CUSTOM";
  granteeIds?: string[];
};

async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN")) {
    return null;
  }

  return appUser;
}

export async function GET() {
  try {
    const appUser = await getAdminUser();
    if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const grantees = await db.grantee.findMany({
      where: { status: "ACTIVE", user: { isActive: true } },
      orderBy: { user: { fullName: "asc" } },
      select: { id: true, user: { select: { fullName: true, email: true } } },
    });

    return NextResponse.json({ grantees: grantees.map(({ id, user }) => ({ id, ...user })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("Failed to load broadcast recipients:", error);
    return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const appUser = await getAdminUser();
    if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = (await request.json()) as BroadcastPayload;
    const subject = String(payload.subject ?? "").trim();
    const body = String(payload.body ?? "").trim();
    const audienceType = payload.audienceType ?? "ALL";
    const granteeIds = Array.isArray(payload.granteeIds) ? payload.granteeIds.filter((id) => typeof id === "string") : [];
    if (!subject || !body) {
      return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });
    }
    if (audienceType !== "ALL" && audienceType !== "CUSTOM") {
      return NextResponse.json({ error: "Invalid audience type." }, { status: 400 });
    }
    if (audienceType === "CUSTOM" && granteeIds.length === 0) {
      return NextResponse.json({ error: "Select at least one grantee." }, { status: 400 });
    }
    const grantees = await db.grantee.findMany({
      where: {
        status: "ACTIVE",
        user: { isActive: true },
        ...(audienceType === "CUSTOM" ? { id: { in: granteeIds } } : {}),
      },
      select: { user: { select: { id: true, email: true } } },
    });
    const recipients = grantees.map(({ user }) => user);

    await db.granteeMessage.createMany({
      data: recipients.map((grantee) => ({
        userId: grantee.id,
        senderId: appUser.id,
        subject,
        body,
      })),
    });

    let emailed = 0;
    let emailFailed = 0;

    try {
      const transporter = createGmailTransporter();
      await Promise.all(
        recipients.map(async (grantee) => {
          try {
            await sendBroadcastEmail(transporter, grantee.email, subject, body);
            emailed += 1;
          } catch (error) {
            emailFailed += 1;
            console.error("Nodemailer error:", error);
          }
        })
      );
    } catch (error) {
      emailFailed = recipients.length - emailed;
      console.error("Nodemailer error:", error);
    }

    return NextResponse.json({
      sent: recipients.length,
      emailed,
      emailFailed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("Failed to send broadcast:", error);
    return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 });
  }
}
