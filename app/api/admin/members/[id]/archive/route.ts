import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { isKKMemberArchiveReason } from "@/lib/kk-member-archive";
import { closeOpenSkeapApplicationsForKkArchive } from "@/lib/kk-archive-skeap-applications";
import { syncKkProfileFromLatestRegistration } from "@/lib/kk-profile-sync";
import {
  refreshKkProfilingApplicationsAdminView,
  refreshSkeapApplicationsAdminView,
} from "@/lib/application-admin-view-refresh";

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
              fullName: true,
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
      if (
        registration.user?.grantee?.status === "ACTIVE" ||
        registration.user?.grantee?.status === "PROBATIONARY"
      ) {
        return {
          error: "Active SKEAP grantees must be managed in Active Grantees first.",
          status: 400 as const,
        };
      }

      const archived = await tx.profilingRegistration.update({
        where: { id },
        data: {
          reviewStatus: "Archived",
          archivedReason: archiveReason,
          archivedAt: new Date(),
          archivedBy: admin.id,
        },
      });

      if (registration.userId) {
        await syncKkProfileFromLatestRegistration(tx, registration.userId);
      }

      if (
        registration.userId &&
        (archiveReason === "Transferred Residence" || archiveReason === "Deceased")
      ) {
        await closeOpenSkeapApplicationsForKkArchive(tx, {
          userId: registration.userId,
          actorId: admin.id,
          reason: archiveReason,
          message: `Your SKEAP application was withdrawn because your KK Youth Registry profile was archived. Reason: ${archiveReason}.`,
        });
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
          archivedBy: archived.archivedBy,
        },
        metadata: { fullName: registration.fullName },
      });

      return { registration: archived };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await Promise.all([refreshKkProfilingApplicationsAdminView(), refreshSkeapApplicationsAdminView()]);

    return NextResponse.json({ success: true, reviewStatus: result.registration.reviewStatus });
  } catch (error) {
    console.error("Failed to archive profiling registration:", error);
    return NextResponse.json({ error: "Failed to archive profile" }, { status: 500 });
  }
}
