import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const db = prisma;
async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return ensureProfile(user);
}

export async function GET() {
  const appUser = await getCurrentUser();
  if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: appUser.id },
    select: { emailNotifications: true },
  });

  return NextResponse.json({
    emailNotifications: user?.emailNotifications ?? true,
  });
}

export async function POST(request: Request) {
  const appUser = await getCurrentUser();
  if (!appUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (typeof body?.emailNotifications !== "boolean") {
    return NextResponse.json({ error: "emailNotifications must be a boolean" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: appUser.id },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

  await db.user.update({
    where: { id: appUser.id },
    data: { emailNotifications: body.emailNotifications },
  });

  return NextResponse.json({ ok: true, emailNotifications: body.emailNotifications });
}
