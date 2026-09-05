import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const db = prisma;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ messages: [] }, { status: 401 });

  const appUser = await ensureProfile(user);
  if (!appUser) return NextResponse.json({ messages: [] }, { status: 401 });

  const messages = await db.granteeMessage.findMany({
    where: { userId: appUser.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { id: true, subject: true, body: true, createdAt: true },
  });

  return NextResponse.json({ messages });
}
