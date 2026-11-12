import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { downgradeInactiveGranteeRole } from "@/lib/grantee-role";
import { refreshInactiveGranteesView } from "@/lib/grantee-archive-view";
import { isKKMemberArchiveReason } from "@/lib/kk-member-archive";
import { reindexSkeapWaitlist } from "@/lib/skeap-waitlist";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  const { id } = await params;

  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Choose a valid archive reason." }, { status: 400 });
    }
    const archiveReason =
      typeof payload === "object" && payload !== null && "archiveReason" in payload
        ? payload.archiveReason
        : undefined;
    if (!isKKMemberArchiveReason(archiveReason)) {
      return NextResponse.json({ error: "Choose a valid archive reason." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const registration = await tx.profilingRegistration.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
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
          archivedReason: archiveReason,
          archivedAt: new Date(),
        },
      });

      if (registration.userId) {
        const waitlistedApplications = await tx.skeapApplication.findMany({
          where: {
            userId: registration.userId,
            status: "WAITLISTED",
          },
          select: { id: true, waitlistPosition: true, applicantName: true },
        });

        if (waitlistedApplications.length > 0) {
          const waitlistRemark = `Automatically removed from waitlist due to KK Member Profile archival (Reason: ${archiveReason}).`;
          const removalResult = await tx.skeapApplication.updateMany({
            where: {
              userId: registration.userId,
              status: "WAITLISTED",
            },
            data: {
              status: "REMOVED",
              waitlistPosition: null,
              waitlistRemark,
            },
          });
          if (removalResult.count !== waitlistedApplications.length) {
            throw new Error("WAITLIST_CHANGED");
          }
          await reindexSkeapWaitlist(tx);

          for (const application of waitlistedApplications) {
            await writeAuditLog(tx, {
              action: "APPLICATION_REMOVED_FROM_WAITLIST",
              actorId: admin.id,
              targetTable: "skeap_applications",
              targetId: application.id,
              beforeData: {
                status: "WAITLISTED",
                waitlistPosition: application.waitlistPosition,
              },
              afterData: {
                status: "REMOVED",
                waitlistPosition: null,
                waitlistRemark,
              },
              metadata: {
                target: application.applicantName || registration.fullName,
                reason: archiveReason,
                profileId: registration.id,
              },
            });
          }
        }
      }

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

        if (registration.user?.id) {
          await downgradeInactiveGranteeRole(tx, registration.user.id);
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
          metadata: { reason: archiveReason, profileId: registration.id },
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
    if (error instanceof Error && error.message === "WAITLIST_CHANGED") {
      return NextResponse.json(
        { error: "The waitlist changed while this profile was being archived. Refresh the page and try again." },
        { status: 409 }
      );
    }
    console.error("Failed to archive profiling registration:", error);
    return NextResponse.json({ error: "Failed to archive profile" }, { status: 500 });
  }
}
