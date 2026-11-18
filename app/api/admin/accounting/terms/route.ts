import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { getAccountingTermOptions } from "@/lib/accounting-term";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const appUser = await ensureProfile(user);
    if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schedules = await prisma.academicTermSchedule.findMany({
      orderBy: { opensAt: "desc" },
      select: { semester: true, opensAt: true, closesAt: true },
    });
    const terms = getAccountingTermOptions(schedules);
    const defaultSemester = terms.find((term) => term.isCurrent)?.name ?? terms[0]?.name ?? null;

    return NextResponse.json({ terms, defaultSemester });
  } catch (error) {
    console.error("Could not load accounting term schedules:", error);
    return NextResponse.json({ error: "Unable to load accounting term schedules." }, { status: 500 });
  }
}
