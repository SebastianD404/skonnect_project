import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const db = prisma;
import { ensureProfile } from "@/lib/auth";

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 50;

function getPositiveInteger(value: string | null, fallback: number, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ inquiries: [], totalCount: 0 });

  const appUser = await ensureProfile(user);
  if (!appUser) return NextResponse.json({ inquiries: [], totalCount: 0 });

  const url = new URL(request.url);
  const page = getPositiveInteger(url.searchParams.get("page"), 1);
  const limit = getPositiveInteger(url.searchParams.get("limit"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const skeapOnly = url.searchParams.get("skeapOnly") === "1";
  const where: Prisma.InquiryWhereInput = {
    userId: appUser.id,
  };

  if (skeapOnly) {
    where.subject = { contains: "SKEAP application", mode: "insensitive" };
  } else {
    where.NOT = { subject: { contains: "SKEAP application", mode: "insensitive" } };
  }

  const [inquiries, totalCount] = await Promise.all([
    db.inquiry.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, subject: true, createdAt: true, isResolved: true, response: true, respondedAt: true, reviewStatus: true },
    }),
    db.inquiry.count({ where }),
  ]);

  return NextResponse.json({ inquiries, totalCount, page, limit });
}
