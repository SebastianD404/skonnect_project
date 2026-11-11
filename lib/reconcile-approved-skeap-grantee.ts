import { Prisma, Role } from "@prisma/client";
import { GRANTEE_PLACEHOLDER_SCHOOL, GRANTEE_PLACEHOLDER_YEAR_LEVEL } from "@/lib/grantee-profile";
import { prisma } from "@/lib/prisma";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";

export async function reconcileApprovedSkeapGrantee(userId: string, role: Role) {
  if (role !== Role.YOUTH && role !== Role.GRANTEE) return false;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });
    if (!user?.isActive || (user.role !== Role.YOUTH && user.role !== Role.GRANTEE)) return false;

    const application = await tx.skeapApplication.findFirst({
      where: { userId, status: "APPROVED" },
      orderBy: { submittedAt: "desc" },
      select: {
        school: true,
        currentCourse: true,
        yearLevel: true,
      },
    });
    if (!application) return false;

    const grantee = await tx.grantee.findUnique({
      where: { userId },
      select: { status: true },
    });
    if (grantee?.status === "REMOVED" || grantee?.status === "GRADUATED") return false;

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

    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
