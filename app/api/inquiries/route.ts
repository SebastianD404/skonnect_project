import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

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

    const inquiry = await prisma.inquiry.create({
      data: {
        userId: appUser.id,
        subject,
        message,
      },
    });

    return NextResponse.json({ success: true, inquiryId: inquiry.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create inquiry";
    console.error(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
