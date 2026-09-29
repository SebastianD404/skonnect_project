import { hasGranteeRetentionColumn, prisma } from "@/lib/prisma";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminGranteesPageClient from "../AdminGranteesPageClient";
import type { GranteeTableRow } from "../grantees/GranteeStatusTable";
import { ensureProfile } from "@/lib/auth";
import {
  GRANTEE_PLACEHOLDER_SCHOOL,
  GRANTEE_PLACEHOLDER_YEAR_LEVEL,
} from "@/lib/grantee-profile";

export default async function AdminGranteesPage() {
  const hasRetentionColumn = await hasGranteeRetentionColumn();
  const supportInquiryFilter = {
    NOT: {
      subject: {
        contains: "SKEAP application",
        mode: "insensitive" as const,
      },
    },
  };

  const [
    grantees,
    openInquiryCount,
    pendingSubmissionCount,
  ] = await Promise.all([
    prisma.grantee.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        yearLevel: true,
        school: true,
        generalAverage: true,
        dateEnrolled: true,
        graduatedAt: true,
        ...(hasRetentionColumn ? { retentionExpiresAt: true } : {}),
        createdAt: true,
        updatedAt: true,
        submissions: {
          orderBy: { submittedAt: "desc" },
          where: { generalAverage: { not: null } },
          take: 1,
          select: {
            generalAverage: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            avatarUrl: true,
            role: true,
            inquiries: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                application: {
                  select: {
                    currentCourse: true,
                    yearLevel: true,
                    gwa: true,
                    applicantName: true,
                    permanentAddress: true,
                    dateOfBirth: true,
                    placeOfBirth: true,
                    age: true,
                    civilStatus: true,
                    gender: true,
                    fathersName: true,
                    fathersOccupation: true,
                    fathersContact: true,
                    mothersMaidenName: true,
                    mothersOccupation: true,
                    mothersContact: true,
                    contactNumber: true,
                    emailAddress: true,
                    photoFileUrl: true,
                    uploadedFiles: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: false } }),
    prisma.submission.count({ where: { status: "PENDING" } }),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await ensureProfile(user);

  if (!appUser) {
    redirect("/login");
  }

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const granteeUsersWithoutProfile = await prisma.user.findMany({
    where: {
      role: "GRANTEE",
      grantee: {
        is: null,
      },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const granteeRows: GranteeTableRow[] = grantees.map((grantee: any) => {
    const latestInquiry = grantee.user.inquiries?.[0] ?? null;
    const latestSubmission = grantee.submissions?.[0] ?? null;
    const application = latestInquiry?.application
      ? {
          currentCourse: latestInquiry.application.currentCourse ?? undefined,
          yearLevel: latestInquiry.application.yearLevel ?? undefined,
          gwa: latestInquiry.application.gwa ?? null,
          applicantName: latestInquiry.application.applicantName ?? undefined,
          permanentAddress: latestInquiry.application.permanentAddress ?? undefined,
          dateOfBirth: latestInquiry.application.dateOfBirth?.toISOString() ?? undefined,
          placeOfBirth: latestInquiry.application.placeOfBirth ?? undefined,
          age: latestInquiry.application.age ?? undefined,
          civilStatus: latestInquiry.application.civilStatus ?? undefined,
          gender: latestInquiry.application.gender ?? undefined,
          fathersName: latestInquiry.application.fathersName ?? undefined,
          fathersOccupation: latestInquiry.application.fathersOccupation ?? undefined,
          fathersContact: latestInquiry.application.fathersContact ?? undefined,
          mothersMaidenName: latestInquiry.application.mothersMaidenName ?? undefined,
          mothersOccupation: latestInquiry.application.mothersOccupation ?? undefined,
          mothersContact: latestInquiry.application.mothersContact ?? undefined,
          contactNumber: latestInquiry.application.contactNumber ?? undefined,
          emailAddress: latestInquiry.application.emailAddress ?? grantee.user.email ?? undefined,
          photoFileUrl: latestInquiry.application.photoFileUrl ?? undefined,
          uploadedFiles: latestInquiry.application.uploadedFiles ?? undefined,
        }
      : null;

    return {
      id: grantee.id,
      fullName: grantee.user.fullName,
      email: grantee.user.email,
      school: grantee.school,
      yearLevel: grantee.yearLevel,
      status: grantee.status,
      generalAverage:
        latestSubmission?.generalAverage ?? latestInquiry?.application?.gwa ?? grantee.generalAverage,
      dateEnrolled: grantee.dateEnrolled.toISOString(),
      graduatedAt: grantee.graduatedAt?.toISOString() ?? null,
      retentionExpiresAt: getRetentionExpiryDate(grantee)?.toISOString() ?? null,
      updatedAt: grantee.updatedAt.toISOString(),
      detailsHref: `/admin/grantees/${grantee.id}`,
      application,
      applicationDownloadHref: latestInquiry ? `/api/admin/skeap-applications/${latestInquiry.id}/download` : undefined,
    };
  });

  const fallbackRows: GranteeTableRow[] = granteeUsersWithoutProfile.map((user: any) => ({
    id: `user-${user.id}`,
    fullName: user.fullName,
    email: user.email,
    school: GRANTEE_PLACEHOLDER_SCHOOL,
    yearLevel: GRANTEE_PLACEHOLDER_YEAR_LEVEL,
    status: "PROBATIONARY",
    generalAverage: null,
    dateEnrolled: user.createdAt.toISOString(),
    graduatedAt: null,
    retentionExpiresAt: null,
    updatedAt: user.updatedAt.toISOString(),
  }));

  const allGranteeRows = [...granteeRows, ...fallbackRows].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  const activeGranteeCount = allGranteeRows.filter(
    (grantee) => grantee.status === "ACTIVE" || grantee.status === "PROBATIONARY"
  ).length;
  const graduatedCount = allGranteeRows.filter((grantee) => grantee.status === "GRADUATED").length;
  const stats = [
    {
      label: "Active Grantees",
      value: `${activeGranteeCount}`,
      sub: "currently enrolled",
      href: "/admin/grantees?status=active",
      accent: "cyan" as const,
      iconName: "Users" as const,
    },
    {
      label: "Pending Submissions",
      value: `${pendingSubmissionCount}`,
      sub: "awaiting review",
      href: "/admin/submissions",
      accent: "amber" as const,
      iconName: "CheckSquare" as const,
    },
    {
      label: "Open Inquiries",
      value: `${openInquiryCount}`,
      sub: "unresolved",
      href: "/admin/inquiries",
      accent: "amber" as const,
      iconName: "Inbox" as const,
    },
    {
      label: "Graduated Scholars",
      value: `${graduatedCount}`,
      sub: "completed term",
      href: "/admin/grantees?status=graduated",
      accent: "emerald" as const,
      iconName: "GraduationCap" as const,
    },
  ];

  const initials = appUser.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: any) => part[0]?.toUpperCase())
    .join("") || "?";

  return (
    <AdminGranteesPageClient
      dateLabel={dateLabel}
      openInquiryCount={openInquiryCount}
      pendingSubmissionCount={pendingSubmissionCount}
      stats={stats}
      grantees={allGranteeRows}
    />
  );
}
