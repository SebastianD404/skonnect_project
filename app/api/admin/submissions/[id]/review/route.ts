import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

type ReviewAction = "APPROVE" | "RETURN_FOR_UPDATE";

type ReviewBody = {
  action?: ReviewAction;
  reviewNotes?: string;
  flaggedFields?: string[];
};

function normalizeFlaggedFields(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(["GRADE_REPORT", "COE"]);
  return raw
    .map((item) => String(item || "").trim().toUpperCase())
    .filter((item): item is string => Boolean(item) && allowed.has(item));
}

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
    const action = body.action;
    const reviewNotes = String(body.reviewNotes ?? "").trim();
    const flaggedFields = normalizeFlaggedFields(body.flaggedFields);

    if (action !== "APPROVE" && action !== "RETURN_FOR_UPDATE") {
      return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
    }

    if (action === "RETURN_FOR_UPDATE" && flaggedFields.length === 0) {
      return NextResponse.json(
        { error: "Flag at least one document before returning for update." },
        { status: 400 }
      );
    }

    if (action === "RETURN_FOR_UPDATE" && !reviewNotes) {
      return NextResponse.json(
        { error: "Review notes are required when returning a submission for update." },
        { status: 400 }
      );
    }

    const existing = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const updated = await prisma.submission.update({
      where: { id },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "RETURNED_FOR_EDIT",
        reviewNotes: action === "APPROVE" ? null : reviewNotes,
        flaggedFields: action === "APPROVE" ? [] : flaggedFields,
        reviewedAt: new Date(),
        reviewedById: appUser.id,
      },
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
