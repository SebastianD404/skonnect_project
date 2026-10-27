import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await ensureProfile(user);
  if (!actor || actor.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sinceValue = request.nextUrl.searchParams.get("since");
  const since = sinceValue ? new Date(sinceValue) : null;
  if (sinceValue && (!since || Number.isNaN(since.getTime()))) {
    return NextResponse.json({ error: "Invalid audit viewed timestamp." }, { status: 400 });
  }

  try {
    const count = await prisma.auditLog.count({
      where: {
        action: { contains: "ROLE", mode: "insensitive" },
        ...(since ? { createdAt: { gt: since } } : {}),
      },
    });

    return NextResponse.json(
      { count },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Failed to load unread audit count:", error);
    return NextResponse.json({ error: "Unable to load unread audit count." }, { status: 500 });
  }
}
