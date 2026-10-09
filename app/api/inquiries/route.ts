import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

const MAX_ACTIVE_INQUIRIES = 3;
const INQUIRY_COOLDOWN_MS = 60_000;
const ACTIVE_INQUIRY_LIMIT_MESSAGE =
  "You have 3 active inquiries. Please wait for SK officials to resolve them before opening a new one.";
const INQUIRY_COOLDOWN_MESSAGE = "Please wait a minute before submitting another inquiry.";

class InquirySubmissionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const inquiry = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${appUser.id} FOR UPDATE
      `;

      const supportInquiryFilter: Prisma.InquiryWhereInput = {
        userId: appUser.id,
        NOT: { subject: { contains: "SKEAP application", mode: "insensitive" } },
      };
      const activeCount = await tx.inquiry.count({
        where: { ...supportInquiryFilter, isResolved: false },
      });
      if (activeCount >= MAX_ACTIVE_INQUIRIES) {
        throw new InquirySubmissionError(ACTIVE_INQUIRY_LIMIT_MESSAGE, 429);
      }

      const latestInquiry = await tx.inquiry.findFirst({
        where: supportInquiryFilter,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { createdAt: true },
      });
      if (latestInquiry && Date.now() - latestInquiry.createdAt.getTime() < INQUIRY_COOLDOWN_MS) {
        throw new InquirySubmissionError(INQUIRY_COOLDOWN_MESSAGE, 429);
      }

      return tx.inquiry.create({
        data: {
          userId: appUser.id,
          subject,
          message,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    return NextResponse.json({ success: true, inquiryId: inquiry.id });
  } catch (err) {
    if (err instanceof InquirySubmissionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Failed to create inquiry";
    console.error(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
