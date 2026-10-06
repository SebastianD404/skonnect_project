import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { getProfilingRegistrationCountByStatusSince, prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const supportInquiryFilter = {
    NOT: {
      subject: {
        contains: "SKEAP application",
        mode: "insensitive" as const,
      },
    },
  };
  const applicationStatusFilter = {
    OR: ["pending", "return", "resubm", "respond"].flatMap((pattern) => [
      { reviewStatus: { contains: pattern, mode: "insensitive" as const } },
      { response: { contains: pattern, mode: "insensitive" as const } },
    ]),
  };

  try {
    const [
      openInquiryCount,
      skeapApplicationCount,
      pendingDocumentCount,
      profilingRegistrationCount,
      newGranteeCount,
      approvedMemberCount,
    ] = await Promise.all([
      prisma.inquiry.count({
        where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: startOfToday } },
      }),
      prisma.inquiry.count({
        where: {
          subject: { contains: "SKEAP application", mode: "insensitive" },
          NOT: [
            { reviewStatus: { contains: "cancel", mode: "insensitive" } },
            { reviewStatus: { contains: "approve", mode: "insensitive" } },
          ],
          AND: [applicationStatusFilter],
          createdAt: { gte: startOfToday },
        },
      }),
      prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: startOfToday } } }),
      prisma.profilingRegistration.count({ where: { submittedAt: { gte: startOfToday } } }),
      prisma.grantee.count({ where: { createdAt: { gte: startOfToday } } }),
      getProfilingRegistrationCountByStatusSince("Approved", startOfToday),
    ]);

    return NextResponse.json(
      {
        counts: {
          openInquiryCount,
          skeapApplicationCount,
          pendingDocumentCount,
          profilingRegistrationCount,
          newGranteeCount,
          approvedMemberCount,
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Failed to load admin sidebar counts:", error);
    return NextResponse.json({ error: "Failed to load sidebar counts." }, { status: 500 });
  }
}
