import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { listProfilingRegistrations } from "@/lib/prisma";
import { exportToExcel } from "@/lib/utils/export";
import { logAuditEvent } from "@/lib/audit/logger";

export async function GET() {
  const admin = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const members = await listProfilingRegistrations({
    where: { reviewStatus: "Approved" },
    orderBy: { submittedAt: "desc" },
    select: {
      fullName: true,
      email: true,
      contactNumber: true,
      age: true,
      youthAgeGroup: true,
      youthClassification: true,
      workStatus: true,
      registeredSKVoter: true,
      reviewStatus: true,
      submittedAt: true,
    },
  });
  const file = exportToExcel(members, "sk-youth-members", "members");
  logAuditEvent({
    actorId: admin.id,
    actorEmail: admin.email,
    action: "RECORDS_EXPORTED",
    resource: "kk_profiling_registrations",
    metadata: { recordCount: members.length, filters: { reviewStatus: "Approved" } },
  });

  return new NextResponse(file.body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
