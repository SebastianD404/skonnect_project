import { prisma } from "@/lib/prisma";
import { ACTIVE_SKEAP_APPLICATION_WHERE, getSkeapMaxSlots } from "@/lib/skeap-capacity";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";

export type SkeapWaitlistApplication = {
  id: string;
  waitlistPosition: number | null;
  submittedAt: string;
  applicantName: string;
  emailAddress: string;
  contactNumber: string | null;
  school: string;
  currentCourse: string;
  yearLevel: string;
};

export type SkeapWaitlistSnapshot = {
  activeCount: number;
  maxSlots: number;
  applications: SkeapWaitlistApplication[];
};

export async function getSkeapWaitlistSnapshot(): Promise<SkeapWaitlistSnapshot> {
  const applications = await prisma.skeapApplication.findMany({
    where: { status: "WAITLISTED" },
    orderBy: [{ waitlistPosition: "asc" }, { submittedAt: "asc" }],
    select: {
      id: true,
      waitlistPosition: true,
      submittedAt: true,
      applicantName: true,
      emailAddress: true,
      contactNumber: true,
      school: true,
      currentCourse: true,
      yearLevel: true,
      user: { select: { fullName: true, email: true } },
    },
  });

  const [activeCount, maxSlots] = await Promise.all([
    prisma.skeapApplication.count({ where: ACTIVE_SKEAP_APPLICATION_WHERE }),
    getSkeapMaxSlots(),
  ]);

  return {
    activeCount,
    maxSlots,
    applications: applications.map((application) => ({
      id: application.id,
      waitlistPosition: application.waitlistPosition,
      submittedAt: application.submittedAt.toISOString(),
      applicantName: application.applicantName || application.user.fullName || application.user.email,
      emailAddress: application.emailAddress || application.user.email,
      contactNumber: application.contactNumber,
      school: normalizeSkeapSchoolName(application.school),
      currentCourse: application.currentCourse,
      yearLevel: application.yearLevel,
    })),
  };
}