import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const registration = await tx.profilingRegistration.findUnique({ where: { id } });
      if (!registration) {
        return { error: "Profile not found", status: 404 as const };
      }

      const restoredStatus = registration.reviewStatus === "Archived"
        ? "Approved"
        : registration.reviewStatus === "Rejected"
          ? "Pending"
          : null;
      if (!restoredStatus) {
        return { error: "Only archived or rejected profiles can be restored", status: 409 as const };
      }

      const restored = await tx.profilingRegistration.update({
        where: { id },
        data: {
          reviewStatus: restoredStatus,
          archivedReason: null,
          archivedAt: null,
          ...(restoredStatus === "Pending" ? { reviewNotes: null } : {}),
        },
      });

      await writeAuditLog(tx, {
        action: "PROFILE_RESTORED",
        actorId: admin.id,
        targetTable: "kk_profiling_registrations",
        targetId: registration.id,
        beforeData: { reviewStatus: registration.reviewStatus },
        afterData: { reviewStatus: restored.reviewStatus },
        metadata: { fullName: registration.fullName },
      });

      return { registration: restored };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      reviewStatus: result.registration.reviewStatus,
    });
  } catch (error) {
    console.error("Failed to restore member profile:", error);
    return NextResponse.json({ error: "Failed to restore profile" }, { status: 500 });
  }
}
