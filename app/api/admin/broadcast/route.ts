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

type BroadcastProgressEvent =
  | { type: "progress"; completed: number; total: number }
  | { type: "complete"; sent: number; emailed: number; emailFailed: number; emailSkipped: number }
  | { type: "error"; error: string };

function wasAcceptedByMailServer(
  acceptedRecipients: Array<string | { address: string }>,
  recipientEmail: string
) {
  const expectedEmail = recipientEmail.toLowerCase();
  return acceptedRecipients.some((accepted) => {
    const address = typeof accepted === "string" ? accepted : accepted.address;
    return address.toLowerCase() === expectedEmail;
  });
}

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

    await Promise.all(recipients.map(async (grantee) => {
      const message = await db.granteeMessage.create({
        data: {
          userId: grantee.id,
          senderId: appUser.id,
          subject,
          body,
        },
        select: { id: true },
      });
      await db.notification.create({
        data: {
          userId: grantee.id,
          sourceKey: `message:${message.id}`,
          isRead: false,
        },
      });
    }));

    let streamCancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const emit = (event: BroadcastProgressEvent) => {
          if (!streamCancelled) {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          }
        };
        let completed = 0;
        let emailed = 0;
        let emailFailed = 0;
        let emailSkipped = 0;

        try {
          emit({ type: "progress", completed, total: recipients.length });
          const transporter = createGmailTransporter();
          await Promise.all(
            recipients.map(async (grantee) => {
              try {
                const result = await sendBroadcastEmail(transporter, grantee.id, grantee.email, subject, body);
                if (!result) {
                  emailSkipped += 1;
                } else if (wasAcceptedByMailServer(result.accepted, grantee.email)) {
                  emailed += 1;
                } else {
                  emailFailed += 1;
                  console.error("Mail server did not accept the broadcast recipient.");
                }
              } catch (error) {
                emailFailed += 1;
                console.error("Nodemailer error:", error);
              }

              completed += 1;
              emit({ type: "progress", completed, total: recipients.length });
            })
          );
        } catch (error) {
          console.error("Nodemailer error:", error);
          while (completed < recipients.length) {
            completed += 1;
            emailFailed += 1;
            emit({ type: "progress", completed, total: recipients.length });
          }
        }

        emit({
          type: "complete",
          sent: recipients.length,
          emailed,
          emailFailed,
          emailSkipped,
        });
        if (!streamCancelled) controller.close();
      },
      cancel() {
        streamCancelled = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    console.error("Failed to send broadcast:", error);
    return NextResponse.json({ error: message || "Internal Server Error" }, { status: 500 });
  }
}
