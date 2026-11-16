import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runGranteeUploadRequirementReminders } from "@/lib/deadline-reminder-runner";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runGranteeUploadRequirementReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Scheduled deadline reminder run failed:", error);
    return NextResponse.json({ error: "Deadline reminder run failed." }, { status: 500 });
  }
}
