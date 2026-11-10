"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { prisma } from "@/lib/prisma";

export async function rejectKKProfilingApplication(id: string, reason: string) {
  const registrationId = id.trim();
  const rejectionReason = reason.trim();

  if (!registrationId) {
    return { error: "Application not found." };
  }
  if (!rejectionReason) {
    return { error: "A reason for rejection is required." };
  }
  if (rejectionReason.length > 1000) {
    return { error: "The rejection reason must be 1,000 characters or fewer." };
  }

  const admin = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  const result = await prisma.$transaction(async (tx) => {
    const registration = await tx.profilingRegistration.findUnique({
      where: { id: registrationId },
    });

    if (!registration) {
      return { error: "Registration not found." };
    }

    if (["approved", "rejected", "archived"].includes(registration.reviewStatus.trim().toLowerCase())) {
      return { error: "This application has already reached a final status." };
    }

    const updateResult = await tx.profilingRegistration.updateMany({
      where: { id: registrationId, reviewStatus: registration.reviewStatus },
      data: { reviewStatus: "Rejected", reviewNotes: rejectionReason },
    });
    if (updateResult.count !== 1) {
      return { error: "The application status changed. Refresh and try again." };
    }

    const updated = await tx.profilingRegistration.findUniqueOrThrow({
      where: { id: registrationId },
    });

    await writeAuditLog(tx, {
      action: "KK_PROFILING_APPLICATION_REJECTED",
      actorId: admin.id,
      targetTable: "kk_profiling_registrations",
      targetId: registrationId,
      beforeData: { reviewStatus: registration.reviewStatus, reviewNotes: registration.reviewNotes },
      afterData: { reviewStatus: updated.reviewStatus, reviewNotes: updated.reviewNotes },
      metadata: {
        target: registration.fullName,
        targetEmail: registration.email,
        reason: rejectionReason,
      },
    });

    return { success: true as const };
  });

  if (result.success) {
    revalidatePath("/admin/kk-profiling");
  }
  return result;
}
