import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGranteeProfileComplete } from "@/lib/grantee-profile";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await prisma.user.findFirst({
      where: {
        OR: [{ authId: user.id }, { email: user.email ?? "" }],
      },
      include: { grantee: true },
    });

    if (appUser && appUser.authId !== user.id) {
      try {
        await prisma.user.update({
          where: { id: appUser.id },
          data: { authId: user.id },
        });
      } catch {
        // Ignore relink failures; request can proceed with resolved user.
      }
    }

    if (!appUser || appUser.role !== "GRANTEE" || !appUser.grantee) {
      return NextResponse.json({ error: "Only grantee accounts can submit documents" }, { status: 403 });
    }

    if (!isGranteeProfileComplete(appUser.grantee)) {
      return NextResponse.json(
        {
          error:
            "Complete your grantee profile (school and year level) in Profile settings before submitting documents.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const semester = String(body.semester ?? "").trim();
    const gradeFileUrl = String(body.gradeFileUrl ?? "").trim();
    const coeFileUrl = String(body.coeFileUrl ?? "").trim();
    const averageRaw = body.generalAverage;
    const generalAverage = averageRaw === "" || averageRaw === null || averageRaw === undefined
      ? null
      : Number(averageRaw);

    if (!semester || !gradeFileUrl || !coeFileUrl) {
      return NextResponse.json(
        { error: "Semester, grade report, and COE are required" },
        { status: 400 }
      );
    }

    if (generalAverage !== null && (Number.isNaN(generalAverage) || generalAverage < 0 || generalAverage > 100)) {
      return NextResponse.json({ error: "General average must be between 0 and 100" }, { status: 400 });
    }

    const existing = await prisma.submission.findFirst({
      where: {
        granteeId: appUser.grantee.id,
        semester,
      },
      orderBy: { submittedAt: "desc" },
    });

    if (existing && (existing.status === "PENDING" || existing.status === "APPROVED")) {
      return NextResponse.json(
        { error: "A submission for this semester already exists and is currently active." },
        { status: 409 }
      );
    }

    const payload = {
      semester,
      gradeFileUrl,
      coeFileUrl,
      generalAverage,
      status: "PENDING" as const,
      reviewNotes: null,
      reviewedAt: null,
      submittedAt: new Date(),
    };

    const submission = existing && existing.status === "REJECTED"
      ? await prisma.submission.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.submission.create({
          data: {
            ...payload,
            granteeId: appUser.grantee.id,
          },
        });

    return NextResponse.json({ success: true, submission });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit documents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
