import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/auth";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ inquiries: [] });

  const appUser = await ensureProfile(user);
  if (!appUser) return NextResponse.json({ inquiries: [] });

  const url = new URL(request.url);
  const skeapOnly = url.searchParams.get("skeapOnly") === "1";
  const where: { userId: string; subject?: { contains: string; mode: "insensitive" } } = {
    userId: appUser.id,
  };

  if (skeapOnly) {
    where.subject = { contains: "SKEAP application", mode: "insensitive" };
  }

  const inquiries = await prisma.inquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, createdAt: true, isResolved: true, response: true },
  });

  return NextResponse.json({ inquiries });
}
