import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { getAuditStartDate, isAuditTimeRange } from "@/lib/audit/time-range";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
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

    const requestedRange = request.nextUrl.searchParams.get("range") ?? "30d";
    if (!isAuditTimeRange(requestedRange)) {
      return NextResponse.json({ error: "Invalid audit time range." }, { status: 400 });
    }
    const startDate = getAuditStartDate(requestedRange);
    const audits = await prisma.auditLog.findMany({
      where: startDate ? { createdAt: { gte: startDate } } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        targetTable: true,
        targetId: true,
        beforeData: true,
        afterData: true,
        metadata: true,
        meta: true,
        createdAt: true,
        actor: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      audits: audits.map((audit) => ({
        id: audit.id,
        action: audit.action,
        targetTable: audit.targetTable,
        targetId: audit.targetId,
        beforeData: audit.beforeData,
        afterData: audit.afterData,
        metadata: audit.metadata,
        meta: audit.meta,
        createdAt: audit.createdAt.toISOString(),
        actorFullName: audit.actor.fullName,
        actorEmail: audit.actor.email,
      })),
    });
  } catch (error) {
    console.error("Failed to load audit logs:", error);
    return NextResponse.json({ error: "Unable to load audit logs." }, { status: 500 });
  }
}
