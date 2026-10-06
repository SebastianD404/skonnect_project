import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const supportInquiryFilter = {
  NOT: {
    subject: {
      contains: "SKEAP application",
      mode: "insensitive" as const,
    },
  },
};

const pendingApplicationsFilter = {
  subject: { contains: "SKEAP application", mode: "insensitive" as const },
  NOT: [
    { reviewStatus: { contains: "cancel", mode: "insensitive" as const } },
    { reviewStatus: { contains: "approve", mode: "insensitive" as const } },
  ],
  AND: [
    {
      OR: [
        { reviewStatus: { contains: "pending", mode: "insensitive" as const } },
        { reviewStatus: { contains: "return", mode: "insensitive" as const } },
        { reviewStatus: { contains: "resubm", mode: "insensitive" as const } },
        { reviewStatus: { contains: "respond", mode: "insensitive" as const } },
      ],
    },
  ],
};

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

  try {
    const [
      totalGrantees,
      openInquiries,
      documentReviews,
      pendingApplications,
      recentInquiries,
      pendingReviews,
    ] = await Promise.all([
      prisma.grantee.count({ where: { status: { in: ["ACTIVE", "PROBATIONARY"] } } }),
      prisma.inquiry.count({ where: { ...supportInquiryFilter, isResolved: false } }),
      prisma.submission.count({ where: { status: "PENDING" } }),
      prisma.inquiry.count({ where: pendingApplicationsFilter }),
      prisma.inquiry.findMany({
        take: 4,
        orderBy: { createdAt: "desc" },
        where: { ...supportInquiryFilter, isResolved: false },
        select: {
          id: true,
          subject: true,
          message: true,
          createdAt: true,
          language: true,
          user: { select: { fullName: true, email: true } },
        },
      }),
      prisma.submission.findMany({
        where: { status: "PENDING" },
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        take: 3,
        select: {
          id: true,
          semester: true,
          coeFileUrl: true,
          gradeFileUrl: true,
          submittedAt: true,
          grantee: {
            select: {
              school: true,
              yearLevel: true,
              user: { select: { fullName: true } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json(
      {
        stats: { totalGrantees, pendingApplications, openInquiries, documentReviews },
        recentInquiries: recentInquiries.map((inquiry) => ({
          ...inquiry,
          createdAt: inquiry.createdAt.toISOString(),
        })),
        pendingReviews: pendingReviews.map((review) => ({
          ...review,
          submittedAt: review.submittedAt.toISOString(),
        })),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Failed to load admin dashboard overview:", error);
    return NextResponse.json({ error: "Failed to load dashboard overview." }, { status: 500 });
  }
}
