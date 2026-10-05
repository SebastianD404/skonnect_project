import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { listProfilingRegistrations, prisma } from "@/lib/prisma";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { createClient } from "@/lib/supabase/server";

type SearchResult = {
  id: string;
  type: string;
  label: string;
  detail: string;
  href: string;
  updatedAt: number;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] satisfies SearchResult[] });
  }

  const contains = { contains: query, mode: "insensitive" as const };
  const [grantees, fallbackUsers, inquiries, profiles, submissions] = await Promise.all([
    prisma.grantee.findMany({
      where: {
        OR: [
          { user: { is: { fullName: contains } } },
          { user: { is: { email: contains } } },
          { school: contains },
          { yearLevel: contains },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        school: true,
        updatedAt: true,
        user: { select: { fullName: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        role: "GRANTEE",
        grantee: { is: null },
        OR: [{ fullName: contains }, { email: contains }],
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, fullName: true, email: true, updatedAt: true },
    }),
    prisma.inquiry.findMany({
      where: {
        OR: [
          { subject: contains },
          { message: contains },
          { user: { is: { fullName: contains } } },
          { user: { is: { email: contains } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        subject: true,
        createdAt: true,
        user: { select: { fullName: true, email: true } },
      },
    }),
    listProfilingRegistrations({
      where: {
        OR: [
          { fullName: contains },
          { email: contains },
          { contactNumber: contains },
          { youthClassification: contains },
          { youthAgeGroup: contains },
        ],
      },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: {
        id: true,
        fullName: true,
        email: true,
        youthClassification: true,
        reviewStatus: true,
        submittedAt: true,
      },
    }),
    prisma.submission.findMany({
      where: {
        OR: [
          { semester: contains },
          { grantee: { is: { school: contains } } },
          { grantee: { is: { user: { is: { fullName: contains } } } } },
          { grantee: { is: { user: { is: { email: contains } } } } },
        ],
      },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: {
        id: true,
        semester: true,
        status: true,
        submittedAt: true,
        grantee: { select: { user: { select: { fullName: true } } } },
      },
    }),
  ]);

  const results: SearchResult[] = [
    ...grantees.map((grantee) => ({
      id: `grantee-${grantee.id}`,
      type: "Grantee",
      label: grantee.user.fullName,
      detail: `${grantee.user.email} · ${normalizeSkeapSchoolName(grantee.school)} · ${grantee.status.toLowerCase()}`,
      href: `/admin/grantees/${grantee.id}`,
      updatedAt: grantee.updatedAt.getTime(),
    })),
    ...fallbackUsers.map((record) => ({
      id: `grantee-user-${record.id}`,
      type: "Grantee account",
      label: record.fullName,
      detail: `${record.email} · No grantee profile yet`,
      href: `/admin/grantees?q=${encodeURIComponent(query)}`,
      updatedAt: record.updatedAt.getTime(),
    })),
    ...inquiries.map((inquiry) => ({
      id: `inquiry-${inquiry.id}`,
      type: "Inquiry",
      label: inquiry.subject,
      detail: `${inquiry.user.fullName} · ${inquiry.user.email}`,
      href: "/admin/inquiries",
      updatedAt: inquiry.createdAt.getTime(),
    })),
    ...profiles.map((profile) => {
      const status = String(profile.reviewStatus ?? "Pending");
      const href = status.toLowerCase() === "approved"
        ? "/admin/members"
        : `/admin/kk-profiling?status=${encodeURIComponent(status.toLowerCase())}`;
      return {
        id: `profile-${profile.id}`,
        type: status.toLowerCase() === "approved" ? "Member" : "KK Profile",
        label: profile.fullName,
        detail: `${profile.email} · ${profile.youthClassification} · ${status}`,
        href,
        updatedAt: new Date(profile.submittedAt).getTime(),
      };
    }),
    ...submissions.map((submission) => ({
      id: `submission-${submission.id}`,
      type: "Submission",
      label: submission.grantee.user.fullName,
      detail: `${submission.semester} · ${submission.status.toLowerCase()}`,
      href: "/admin/submissions",
      updatedAt: submission.submittedAt.getTime(),
    })),
  ];

  results.sort((left, right) => right.updatedAt - left.updatedAt);
  return NextResponse.json({ results: results.slice(0, 12) });
}
