import { NextRequest, NextResponse } from "next/server";
import { SubmissionStatus } from "@prisma/client";
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

    if (!semester) {
      return NextResponse.json(
        { error: "Semester is required" },
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
      select: {
        id: true,
        status: true,
        gradeFileUrl: true,
        coeFileUrl: true,
        generalAverage: true,
        flaggedFields: true,
        reviewNotes: true,
      },
    });

    const mergedGradeFileUrl = gradeFileUrl || existing?.gradeFileUrl || "";
    const mergedCoeFileUrl = coeFileUrl || existing?.coeFileUrl || "";
    const mergedGeneralAverage =
      generalAverage !== null ? generalAverage : existing?.generalAverage ?? null;

    if (!mergedCoeFileUrl) {
      return NextResponse.json({ error: "Certificate of Enrollment is required." }, { status: 400 });
    }

    if (gradeFileUrl && !mergedCoeFileUrl) {
      return NextResponse.json(
        { error: "Submit enrollment verification first before uploading grades." },
        { status: 400 }
      );
    }

    // Only block if submission is fully completed (both COE and grades approved)
    if (existing?.status === "APPROVED" && existing?.gradeFileUrl) {
      return NextResponse.json(
        { error: "An approved submission for this semester cannot be modified." },
        { status: 409 }
      );
    }

    const resolvedFlaggedFields = new Set<string>();

    if (existing?.status === "RETURNED_FOR_EDIT") {
      if (gradeFileUrl && existing.flaggedFields.includes("GRADE_REPORT")) {
        resolvedFlaggedFields.add("GRADE_REPORT");
      }
      if (coeFileUrl && existing.flaggedFields.includes("COE")) {
        resolvedFlaggedFields.add("COE");
      }
    }

    const nextFlaggedFields = existing?.status === "RETURNED_FOR_EDIT"
      ? existing.flaggedFields.filter((field) => !resolvedFlaggedFields.has(field))
      : [];

    const payload = {
      semester,
      gradeFileUrl: mergedGradeFileUrl,
      coeFileUrl: mergedCoeFileUrl,
      generalAverage: mergedGeneralAverage,
      status:
        existing?.status === "RETURNED_FOR_EDIT" && nextFlaggedFields.length > 0
          ? SubmissionStatus.RETURNED_FOR_EDIT
          : SubmissionStatus.PENDING,
      reviewNotes: nextFlaggedFields.length > 0 ? existing?.reviewNotes : null,
      flaggedFields: nextFlaggedFields,
      reviewedAt: null,
      submittedAt: new Date(),
    };

    const submission = existing
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
