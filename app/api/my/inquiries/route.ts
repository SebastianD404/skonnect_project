import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ inquiries: [] });

  const appUser = await prisma.user.findUnique({ where: { authId: user.id } });
  if (!appUser) return NextResponse.json({ inquiries: [] });

  const inquiries = await prisma.inquiry.findMany({
    where: { userId: appUser.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, createdAt: true, isResolved: true, response: true },
  });

  return NextResponse.json({ inquiries });
}
