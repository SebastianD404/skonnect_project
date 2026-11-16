import { Role } from "@prisma/client";
import { GRANTEE_PLACEHOLDER_SCHOOL, GRANTEE_PLACEHOLDER_YEAR_LEVEL } from "@/lib/grantee-profile";
import { prisma } from "@/lib/prisma";
import { refreshSystemUsersAdminView } from "@/lib/application-admin-view-refresh";
import { getSkeapCapacityCount, getSkeapMaxSlots, lockSkeapCapacity } from "@/lib/skeap-capacity";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";

export async function reconcileApprovedSkeapGrantee(userId: string, role: Role) {
  if (role !== Role.YOUTH && role !== Role.GRANTEE) return false;

  const result = await prisma.$transaction(async (tx) => {
    await lockSkeapCapacity(tx);
    const maxSlots = await getSkeapMaxSlots(tx);
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });
    if (!user?.isActive || (user.role !== Role.YOUTH && user.role !== Role.GRANTEE)) {
      return { isApprovedGrantee: false, changed: false };
    }

    const application = await tx.skeapApplication.findFirst({
      where: { userId, status: "APPROVED" },
      orderBy: { submittedAt: "desc" },
      select: {
        school: true,
        currentCourse: true,
        yearLevel: true,
      },
    });
    if (!application) return { isApprovedGrantee: false, changed: false };

    const grantee = await tx.grantee.findUnique({
      where: { userId },
      select: { status: true },
    });
    if (
      grantee?.status === "REMOVED" ||
      grantee?.status === "REVOKED" ||
      grantee?.status === "GRADUATED"
    ) {
      return { isApprovedGrantee: false, changed: false };
    }
    if (!grantee && await getSkeapCapacityCount(tx, userId) >= maxSlots) {
      return { isApprovedGrantee: false, changed: false };
    }

    if (user.role === Role.YOUTH) {
      await tx.user.update({
        where: { id: userId },
        data: { role: Role.GRANTEE },
      });
    }

    if (!grantee) {
      await tx.grantee.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          school: normalizeSkeapSchoolName(
            application.school || application.currentCourse || GRANTEE_PLACEHOLDER_SCHOOL
          ),
          yearLevel: application.yearLevel || GRANTEE_PLACEHOLDER_YEAR_LEVEL,
          status: "ACTIVE",
          dateEnrolled: new Date(),
        },
      });
    }

    return {
      isApprovedGrantee: true,
      changed: user.role === Role.YOUTH || !grantee,
    };
  });

  if (result.changed) await refreshSystemUsersAdminView();
  return result.isApprovedGrantee;
}
