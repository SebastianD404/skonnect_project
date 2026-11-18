import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { syncKkProfileFromLatestRegistration } from "@/lib/kk-profile-sync";
import { refreshKkProfilingApplicationsAdminView } from "@/lib/application-admin-view-refresh";
import { getExactAge } from "@/lib/skeap-age";
import { notifyProfileRestored } from "@/lib/notify-profile-restored";

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

      const age = getExactAge(registration.birthDate);
      if (restoredStatus === "Approved" && age === null) {
        return { error: "Unable to verify the resident's age. The profile cannot be restored.", status: 422 as const };
      }
      if (restoredStatus === "Approved" && age !== null && age >= 31) {
        return {
          error: "Cannot restore profile: This resident is 31+ years old and exceeds the Katipunan ng Kabataan age bracket (15–30 under RA 10742).",
          status: 409 as const,
        };
      }

      const restored = await tx.profilingRegistration.update({
        where: { id },
        data: {
          reviewStatus: restoredStatus,
          archivedReason: null,
          archivedAt: null,
          archivedBy: null,
          ...(restoredStatus === "Pending" ? { reviewNotes: null } : {}),
        },
      });

      if (registration.userId) {
        await syncKkProfileFromLatestRegistration(tx, registration.userId);
      }

      await writeAuditLog(tx, {
        action: "PROFILE_RESTORED",
        actorId: admin.id,
        targetTable: "kk_profiling_registrations",
        targetId: registration.id,
        beforeData: {
          reviewStatus: registration.reviewStatus,
          archivedReason: registration.archivedReason,
          archivedAt: registration.archivedAt,
          archivedBy: registration.archivedBy,
        },
        afterData: {
          reviewStatus: restored.reviewStatus,
          archivedReason: null,
          archivedAt: null,
          archivedBy: null,
        },
        metadata: { fullName: registration.fullName, calculatedAge: age },
      });

      return { registration: restored };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (result.registration.reviewStatus === "Approved") {
      try {
        await notifyProfileRestored({
          userId: result.registration.userId,
          email: result.registration.email,
          fullName: result.registration.fullName,
          registrationId: result.registration.id,
          restoredAt: new Date(),
        });
      } catch (error) {
        console.error("Could not complete KK profile restoration notifications.", {
          registrationId: result.registration.id,
          error,
        });
      }
    }
    await refreshKkProfilingApplicationsAdminView();
    revalidatePath("/admin/members/records");
    revalidatePath("/admin/registry/masterlist");
    revalidatePath("/admin");
    return NextResponse.json({
      success: true,
      reviewStatus: result.registration.reviewStatus,
      fullName: result.registration.fullName,
    });
  } catch (error) {
    console.error("Failed to restore member profile:", error);
    return NextResponse.json({ error: "Failed to restore profile" }, { status: 500 });
  }
}
