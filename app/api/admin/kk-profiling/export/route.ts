import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";

function csvEscape(value: unknown): string {
  const raw = String(value ?? "");
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

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
    if (!actor || (actor.role !== Role.SK_OFFICIAL && actor.role !== Role.SUPER_ADMIN)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const registrations = await prisma.profilingRegistration.findMany({
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        contactNumber: true,
        address: true,
        age: true,
        sex: true,
        youthClassification: true,
        youthAgeGroup: true,
        reviewStatus: true,
        reviewNotes: true,
        submittedAt: true,
      },
    });

    const header = [
      "id",
      "full_name",
      "email",
      "contact_number",
      "address",
      "age",
      "sex",
      "youth_classification",
      "youth_age_group",
      "review_status",
      "review_notes",
      "submitted_at",
    ];

    const rows = registrations.map((registration) => [
      registration.id,
      registration.fullName,
      registration.email,
      registration.contactNumber,
      registration.address,
      registration.age,
      registration.sex,
      registration.youthClassification,
      registration.youthAgeGroup,
      registration.reviewStatus,
      registration.reviewNotes,
      registration.submittedAt.toISOString(),
    ].map(csvEscape));

    const csv = [header.map(csvEscape).join(","), ...rows.map((row) => row.join(","))].join("\n");
    const filename = `kk-profiling-export-${new Date().toISOString().slice(0, 10)}.csv`;

    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        action: "EXPORT_KK_PROFILING_DATA",
        actorId: actor.id,
        targetTable: "kk_profiling_registrations",
        targetId: `export-${Date.now()}`,
        beforeData: null,
        afterData: {
          exportedCount: registrations.length,
          format: "csv",
        },
        metadata: {
          target: "KK profiling database",
          targetId: "kk_profiling_registrations",
          exportedCount: registrations.length,
          format: "csv",
        },
      });
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export KK profiling data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
