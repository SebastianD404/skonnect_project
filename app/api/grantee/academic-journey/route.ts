import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  getAcademicJourneyTermsForBounds,
  isValidAcademicJourneyRange,
} from "@/lib/academic-journey";

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
    !("startAcademicYear" in body) ||
    !("startSemester" in body) ||
    !("endSemester" in body) ||
    typeof body.journeyStart !== "string" ||
    typeof body.journeyEnd !== "string" ||
    typeof body.startAcademicYear !== "string" ||
    !/^\d{4}-\d{4}$/.test(body.startAcademicYear) ||
    Number(body.startAcademicYear.slice(5)) !== Number(body.startAcademicYear.slice(0, 4)) + 1 ||
    (body.startSemester !== 1 && body.startSemester !== 2) ||
    (body.endSemester !== 1 && body.endSemester !== 2) ||
    !isValidAcademicJourneyRange(body.journeyStart, body.journeyEnd)
  ) {
    return NextResponse.json(
      { error: "Choose a graduation target that follows your starting point." },
      { status: 400 },
    );
  }
  if (
    getAcademicJourneyTermsForBounds(
      body.journeyStart,
      body.journeyEnd,
      body.startSemester,
      body.endSemester,
    ).length === 0
  ) {
    return NextResponse.json(
      { error: "Choose a graduation term that follows your starting term." },
      { status: 400 },
    );
  }

  const journey = await prisma.grantee.update({
    where: { id: appUser.grantee.id },
    data: {
      journeyStart: body.journeyStart,
      journeyEnd: body.journeyEnd,
      journeyStartAcademicYear: body.startAcademicYear,
      journeyStartSemester: body.startSemester,
      journeyEndSemester: body.endSemester,
    },
    select: {
      journeyStart: true,
      journeyEnd: true,
      journeyStartAcademicYear: true,
      journeyStartSemester: true,
      journeyEndSemester: true,
    },
  });

  return NextResponse.json({
    journeyStart: journey.journeyStart,
    journeyEnd: journey.journeyEnd,
    startAcademicYear: journey.journeyStartAcademicYear,
    startSemester: journey.journeyStartSemester,
    endSemester: journey.journeyEndSemester,
  });
}
