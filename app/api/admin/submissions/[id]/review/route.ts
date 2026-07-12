import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type ReviewAction = "APPROVE" | "RETURN_FOR_UPDATE";
type DocumentType = "coe" | "grades";

type GradeRow = {
  subject?: string;
  grade?: number | string;
};

function computeAverageFromGradeRows(rows?: GradeRow[] | null): number | null {
  if (!rows || rows.length === 0) return null;
  const validGrades = rows
    .map((row) => Number(row.grade))
    .filter((value) => !Number.isNaN(value) && value >= 0 && value <= 100);
  if (validGrades.length === 0) return null;
  return Number((validGrades.reduce((sum, value) => sum + value, 0) / validGrades.length).toFixed(2));
}

type ReviewBody = {
  documentType?: DocumentType;
  action?: ReviewAction;
  reviewNotes?: string;
  flaggedFields?: string[];
};


export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Submission id is required" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as ReviewBody;
    const documentType = body.documentType || "coe";
    const action = body.action;
    const reviewNotes = String(body.reviewNotes ?? "").trim();

    if (action !== "APPROVE" && action !== "RETURN_FOR_UPDATE") {
      return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
    }

    if (documentType !== "coe" && documentType !== "grades") {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }

    if (action === "RETURN_FOR_UPDATE" && !reviewNotes) {
      return NextResponse.json(
        { error: "Review notes are required when returning a document for correction." },
        { status: 400 }
      );
    }

    const existing = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        coeFileUrl: true,
        gradeFileUrl: true,
        gradeRows: true,
        flaggedFields: true,
        status: true,
        generalAverage: true,
        grantee: {
          select: {
            generalAverage: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    let flaggedFields = existing.flaggedFields || [];
    let newStatus = existing.status;
    let newReviewNotes = existing.status === "RETURNED_FOR_EDIT" ? null : reviewNotes;

    if (documentType === "coe") {
      if (action === "APPROVE") {
        // Remove COE from flagged fields when approved
        flaggedFields = flaggedFields.filter((field) => field !== "COE");
        // Determine new status: if grades exist and pending, stay PENDING; otherwise APPROVED
        if (existing.gradeFileUrl) {
          newStatus = "PENDING";
        } else {
          newStatus = "APPROVED";
        }
        newReviewNotes = null;
      } else {
        // Return COE for correction
        if (!flaggedFields.includes("COE")) {
          flaggedFields = [...flaggedFields, "COE"];
        }
        newStatus = "RETURNED_FOR_EDIT";
        newReviewNotes = reviewNotes;
      }
    } else if (documentType === "grades") {
      if (action === "APPROVE") {
        // Remove GRADE_REPORT from flagged fields when approved
        flaggedFields = flaggedFields.filter((field) => field !== "GRADE_REPORT");
        // If no other flagged fields remain, mark entire submission as APPROVED
        if (flaggedFields.length === 0) {
          newStatus = "APPROVED";
        }
        newReviewNotes = null;
      } else {
        // Return GRADE_REPORT for correction
        if (!flaggedFields.includes("GRADE_REPORT")) {
          flaggedFields = [...flaggedFields, "GRADE_REPORT"];
        }
        newStatus = "RETURNED_FOR_EDIT";
        newReviewNotes = reviewNotes;
      }
    }

    // If we're approving a grade submission and the submission becomes fully approved, ensure a generalAverage is persisted.
    const updateData: any = {
      status: newStatus,
      reviewNotes: newReviewNotes,
      flaggedFields,
      reviewedAt: new Date(),
      reviewedById: appUser.id,
    };

    const hasGradeReport = Boolean(existing.gradeFileUrl);
    if (newStatus === "APPROVED" && hasGradeReport && (existing.generalAverage === null || existing.generalAverage === undefined)) {
      const computedAverage = computeAverageFromGradeRows(existing.gradeRows);
      const fallback = computedAverage ?? existing.grantee?.generalAverage ?? null;
      if (fallback !== null && fallback !== undefined) {
        updateData.generalAverage = fallback;
      } else {
        return NextResponse.json(
          {
            error:
              "Cannot approve this submission because the grade report has no recorded general average. Please ask the grantee to resubmit with a valid general average.",
          },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.submission.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to review submission";
    if (/flaggedFields|does not exist/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Database is missing the submissions.flaggedFields column. Apply the latest Prisma migration before using Return for Update.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
