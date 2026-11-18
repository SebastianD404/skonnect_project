import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { resolveKKMemberArchiveReason } from "@/lib/kk-member-archive";
import { closeOpenSkeapApplicationsForKkArchive } from "@/lib/kk-archive-skeap-applications";
import { syncKkProfileFromLatestRegistration } from "@/lib/kk-profile-sync";
import { notifyProfileArchived } from "@/lib/notify-profile-archived";
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
    const archiveReason = typeof payload === "object" && payload !== null && "archiveReason" in payload
      ? payload.archiveReason
      : undefined;
    const customReason = typeof payload === "object" && payload !== null && "customReason" in payload
      ? payload.customReason
      : undefined;
    const storedArchiveReason = resolveKKMemberArchiveReason(archiveReason, customReason);
    if (!storedArchiveReason) {
      return NextResponse.json({ error: "Choose a valid archive reason." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const registration = await tx.profilingRegistration.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
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
          error: "Active SKEAP grantees must be managed in Active Grantees before archiving their KK profile.",
          status: 400 as const,
        };
      }

      const archived = await tx.profilingRegistration.update({
        where: { id },
        data: {
          reviewStatus: "Archived",
          archivedReason: storedArchiveReason,
          archivedAt: new Date(),
          archivedBy: admin.id,
        },
      });

      if (registration.userId) {
        await syncKkProfileFromLatestRegistration(tx, registration.userId);
      }

      if (
        registration.userId &&
        (storedArchiveReason === "Transferred Residence" ||
          storedArchiveReason === "Voluntary Withdrawal / Opt-Out" ||
          storedArchiveReason === "Deceased")
      ) {
        await closeOpenSkeapApplicationsForKkArchive(tx, {
          userId: registration.userId,
          actorId: admin.id,
          reason: storedArchiveReason,
          message: `Your SKEAP application was withdrawn because your KK Youth Registry profile was archived. Reason: ${storedArchiveReason}.`,
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
        metadata: {
          fullName: registration.fullName,
          archivedReason: storedArchiveReason,
        },
      });

      return {
        registration: archived,
        userId: registration.user?.id ?? registration.userId,
        email: registration.user?.email ?? registration.email,
        fullName: registration.user?.fullName ?? registration.fullName,
      };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const archiveNotification = await notifyProfileArchived({
      userId: result.userId,
      email: result.email,
      fullName: result.fullName,
      archiveType: "ADMIN_ARCHIVED",
      reason: result.registration.archivedReason,
      archivedAt: result.registration.archivedAt ?? new Date(),
    });

    await Promise.all([refreshKkProfilingApplicationsAdminView(), refreshSkeapApplicationsAdminView()]);

    return NextResponse.json({
      success: true,
      reviewStatus: result.registration.reviewStatus,
      archiveNotification,
    });
  } catch (error) {
    console.error("Failed to archive profiling registration:", error);
    return NextResponse.json({ error: "Failed to archive profile" }, { status: 500 });
  }
}
