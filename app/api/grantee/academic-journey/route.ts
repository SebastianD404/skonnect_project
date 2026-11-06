import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isValidAcademicJourneyRange } from "@/lib/academic-journey";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please sign in to save your journey." }, { status: 401 });
  }

  const appUser = await prisma.user.findFirst({
    where: { authId: user.id, isActive: true, role: "GRANTEE" },
    select: { id: true, grantee: { select: { id: true } } },
  });
  if (!appUser?.grantee) {
    return NextResponse.json({ error: "We couldn't find your active grantee profile." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please choose a starting point and graduation target." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("journeyStart" in body) ||
    !("journeyEnd" in body) ||
    typeof body.journeyStart !== "string" ||
    typeof body.journeyEnd !== "string" ||
    !isValidAcademicJourneyRange(body.journeyStart, body.journeyEnd)
  ) {
    return NextResponse.json(
      { error: "Choose a graduation target that follows your starting point." },
      { status: 400 },
    );
  }

  const journey = await prisma.grantee.update({
    where: { id: appUser.grantee.id },
    data: {
      journeyStart: body.journeyStart,
      journeyEnd: body.journeyEnd,
    },
    select: { journeyStart: true, journeyEnd: true },
  });

  return NextResponse.json(journey);
}
