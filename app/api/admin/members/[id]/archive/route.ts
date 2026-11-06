import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { refreshInactiveGranteesView } from "@/lib/grantee-archive-view";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const registration = await tx.profilingRegistration.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              grantee: {
                select: { id: true, status: true, remarks: true },
              },
            },
          },
        },
      });
      if (!registration) {
        return { error: "Registration not found", status: 404 as const };
      }
      if (registration.reviewStatus !== "Approved") {
        return { error: "Only approved profiles can be archived", status: 409 as const };
      }

      const archived = await tx.profilingRegistration.update({
        where: { id },
        data: {
          reviewStatus: "Archived",
          archivedReason: "Archived by administrator",
          archivedAt: new Date(),
        },
      });

      const grantee = registration.user?.grantee;
      let granteeStatusChanged = false;
      if (grantee && (grantee.status === "ACTIVE" || grantee.status === "PROBATIONARY")) {
        const dateRemoved = new Date();
        const updateResult = await tx.grantee.updateMany({
          where: {
            id: grantee.id,
            status: { in: ["ACTIVE", "PROBATIONARY"] },
          },
          data: {
            status: "REMOVED",
            dateRemoved,
            remarks: "Member profile archived by administrator",
          },
        });
        if (updateResult.count !== 1) {
          throw new Error("GRANTEE_STATUS_CHANGED");
        }

        await writeAuditLog(tx, {
          action: "GRANTEE_STATUS_CHANGED",
          actorId: admin.id,
          targetTable: "grantees",
          targetId: grantee.id,
          beforeData: { status: grantee.status, remarks: grantee.remarks },
          afterData: {
            status: "REMOVED",
            dateRemoved: dateRemoved.toISOString(),
            remarks: "Member profile archived by administrator",
          },
          metadata: { reason: "Archived by administrator", profileId: registration.id },
        });
        granteeStatusChanged = true;
      }

      await writeAuditLog(tx, {
        action: "PROFILE_ARCHIVED",
        actorId: admin.id,
        targetTable: "kk_profiling_registrations",
        targetId: registration.id,
        beforeData: { reviewStatus: registration.reviewStatus },
        afterData: {
          reviewStatus: archived.reviewStatus,
          archivedReason: archived.archivedReason,
          archivedAt: archived.archivedAt?.toISOString(),
        },
        metadata: { fullName: registration.fullName },
      });

      return { registration: archived, granteeStatusChanged };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.granteeStatusChanged) {
      try {
        await refreshInactiveGranteesView();
      } catch (error) {
        console.error("Member profile was archived, but the inactive grantee view could not be refreshed:", error);
        return NextResponse.json(
          { error: "Profile was archived, but the grantee archive report could not be refreshed. Please retry the report refresh." },
          { status: 503 }
        );
      }
    }

    return NextResponse.json({ success: true, reviewStatus: result.registration.reviewStatus });
  } catch (error) {
    if (error instanceof Error && error.message === "GRANTEE_STATUS_CHANGED") {
      return NextResponse.json(
        { error: "The linked grantee status changed. Refresh the page and try again." },
        { status: 409 }
      );
    }
    console.error("Failed to archive profiling registration:", error);
    return NextResponse.json({ error: "Failed to archive profile" }, { status: 500 });
  }
}
