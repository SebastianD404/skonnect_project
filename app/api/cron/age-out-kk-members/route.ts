import { timingSafeEqual } from "node:crypto";
import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { checkAndArchiveAgedOutMembers } from "@/lib/archiveAgedOutMembers";
import { prisma } from "@/lib/prisma";

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
    const auditActor = await prisma.user.findFirst({
      where: { role: { in: [Role.SK_OFFICIAL, Role.SUPER_ADMIN] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    if (!auditActor) {
      return NextResponse.json(
        { error: "An SK official or super admin is required to audit age-out actions." },
        { status: 503 },
      );
    }

    const result = await checkAndArchiveAgedOutMembers(auditActor.id, "scheduled");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Scheduled KK age-out run failed:", error);
    return NextResponse.json({ error: "KK age-out run failed." }, { status: 500 });
  }
}
