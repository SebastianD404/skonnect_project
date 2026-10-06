import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { hasProfilingRegistrationColumn, listProfilingRegistrations } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { exportToExcel } from "@/lib/utils/export";
import { logAuditEvent } from "@/lib/audit/logger";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestedStatus = request.nextUrl.searchParams.get("status")?.toLowerCase() ?? "pending";
  const statusLabels: Record<string, string> = {
    pending: "Pending",
    returned: "Returned",
    resubmitted: "Resubmitted",
    approved: "Approved",
  };
  const statusLabel = statusLabels[requestedStatus];
  if (!statusLabel) {
    return NextResponse.json({ error: "Invalid profiling status." }, { status: 400 });
  }

  const hasReviewStatusColumn = await hasProfilingRegistrationColumn("reviewStatus");
  const registrations = await listProfilingRegistrations({
    where: hasReviewStatusColumn ? { reviewStatus: statusLabel } : undefined,
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

  const file = exportToExcel(registrations, `kk-profiling-${requestedStatus}`, "kk-profiling");
  logAuditEvent({
    actorId: appUser.id,
    actorEmail: appUser.email,
    action: "RECORDS_EXPORTED",
    resource: "kk_profiling_registrations",
    metadata: { recordCount: registrations.length, filters: { reviewStatus: statusLabel } },
  });

  return new NextResponse(file.body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
