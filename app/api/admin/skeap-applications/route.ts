import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { mapInquiryToApplication, skeapStatusWhere, SKEAP_APPLICATION_SELECT } from "@/lib/skeap-applications";
import { getAcademicYearDateRange, getCurrentAcademicYear } from "@/lib/semester";

const PAGE_SIZE = 15;

async function authorizeAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const appUser = await ensureProfile(user);
  return appUser?.role === Role.SK_OFFICIAL || appUser?.role === Role.SUPER_ADMIN;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await authorizeAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cursorId = request.nextUrl.searchParams.get("cursorId");
    const cursorDateValue = request.nextUrl.searchParams.get("cursorDate");
    const academicYear = request.nextUrl.searchParams.get("academicYear") ?? getCurrentAcademicYear();
    const academicYearRange = getAcademicYearDateRange(academicYear);
    const cursorDate = cursorDateValue ? new Date(cursorDateValue) : null;
    if (!academicYearRange) {
      return NextResponse.json({ error: "Invalid academic year." }, { status: 400 });
    }
    if (cursorId && (!cursorDate || Number.isNaN(cursorDate.getTime()))) {
      return NextResponse.json({ error: "Invalid pagination cursor." }, { status: 400 });
    }

    const subjectWhere: Prisma.InquiryWhereInput = {
      subject: { contains: "SKEAP application", mode: Prisma.QueryMode.insensitive },
    };
    const cursorWhere: Prisma.InquiryWhereInput[] = cursorId && cursorDate
      ? [{
          OR: [
            { createdAt: { lt: cursorDate } },
            { createdAt: cursorDate, id: { lt: cursorId } },
          ],
        }]
      : [];

    const inquiries = await prisma.inquiry.findMany({
      where: {
        ...subjectWhere,
        NOT: [{ reviewStatus: { contains: "cancel", mode: Prisma.QueryMode.insensitive } }],
        AND: [
          { createdAt: { gte: academicYearRange.start, lt: academicYearRange.end } },
          skeapStatusWhere(["pending", "return", "resubm", "respond", "approve"]),
          ...cursorWhere,
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      select: SKEAP_APPLICATION_SELECT,
    });

    const hasNextPage = inquiries.length > PAGE_SIZE;
    const page = inquiries.slice(0, PAGE_SIZE);
    const lastInquiry = page[page.length - 1];

    return NextResponse.json({
      applications: page.map(mapInquiryToApplication),
      hasNextPage,
      nextCursor: hasNextPage && lastInquiry
        ? { id: lastInquiry.id, createdAt: lastInquiry.createdAt.toISOString() }
        : null,
    });
  } catch (error) {
    console.error("Failed to load SKEAP application page:", error);
    return NextResponse.json({ error: "Failed to load applications." }, { status: 500 });
  }
}
