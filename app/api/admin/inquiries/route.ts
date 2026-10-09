import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 50;

type ReviewThreadMessage = {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
};

function getPositiveInteger(value: string | null, fallback: number, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function normalizeReviewThread(value: Prisma.JsonValue): ReviewThreadMessage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const { id, role, createdAt, text } = entry as Prisma.JsonObject;
    if (
      typeof id !== "string" ||
      (role !== "admin" && role !== "applicant") ||
      typeof createdAt !== "string" ||
      typeof text !== "string"
    ) {
      return [];
    }
    return [{ id, role, createdAt, text }];
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await ensureProfile(user);
  if (!appUser) return NextResponse.json({ error: "User not found" }, { status: 401 });
  if (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = getPositiveInteger(request.nextUrl.searchParams.get("page"), 1);
  const limit = getPositiveInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const requestedId = request.nextUrl.searchParams.get("id");
  const status = request.nextUrl.searchParams.get("status");
  const statusWhere: Prisma.InquiryWhereInput = status === "OPEN"
    ? { isResolved: false }
    : status === "RESOLVED"
      ? { isResolved: true }
      : {};
  const baseWhere: Prisma.InquiryWhereInput = {
    NOT: { subject: { contains: "SKEAP application", mode: "insensitive" } },
  };
  const where: Prisma.InquiryWhereInput = { ...baseWhere, ...statusWhere };
  const [rows, totalCount] = await Promise.all([
    prisma.inquiry.findMany({
      where: requestedId ? { ...baseWhere, id: requestedId } : where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: requestedId ? 0 : (page - 1) * limit,
      take: requestedId ? 1 : limit,
      include: { user: { select: { fullName: true, email: true } } },
    }),
    prisma.inquiry.count({ where: requestedId ? baseWhere : where }),
  ]);

  const inquiries = rows.map((inquiry) => ({
    ...inquiry,
    createdAt: inquiry.createdAt.toISOString(),
    respondedAt: inquiry.respondedAt?.toISOString() ?? null,
    reviewThread: normalizeReviewThread(inquiry.reviewThread),
  }));

  return NextResponse.json({ inquiries, totalCount, page, limit });
}
