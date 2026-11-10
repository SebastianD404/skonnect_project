import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createGmailTransporter, sendTransactionalEmail } from "@/lib/broadcast-email";
import { refreshInactiveGranteesView } from "@/lib/grantee-archive-view";
import { downgradeInactiveGranteeRole } from "@/lib/grantee-role";

type ReviewAction = "APPROVE" | "RETURN_FOR_UPDATE" | "REVOKE";
type DocumentType = "coe" | "grades";

type ReviewBody = {
  documentType?: DocumentType;
  action?: ReviewAction;
  reviewNotes?: string;
  flaggedFields?: string[];
  reason?: string;
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
    const revocationReason = String(body.reason ?? "").trim();

    if (action !== "APPROVE" && action !== "RETURN_FOR_UPDATE" && action !== "REVOKE") {
      return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
    }

    if (action !== "REVOKE" && documentType !== "coe" && documentType !== "grades") {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }

    if (action === "RETURN_FOR_UPDATE" && !reviewNotes) {
      return NextResponse.json(
        { error: "Review notes are required when returning a document for correction." },
        { status: 400 }
      );
    }
    if (action === "REVOKE" && !revocationReason) {
      return NextResponse.json({ error: "A reason for revocation is required." }, { status: 400 });
    }

    const existing = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        coeFileUrl: true,
        gradeFileUrl: true,
        flaggedFields: true,
        status: true,
        coeStatus: true,
        gradesStatus: true,
        grantee: {
          select: {
            id: true,
            status: true,
            user: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        },
      } as Prisma.SubmissionSelect,
    });

    if (!existing) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (existing.grantee?.status === "GRADUATED") {
      return NextResponse.json({ error: "Graduated scholar submissions are locked for statutory retention." }, { status: 409 });
    }
    if (action === "REVOKE") {
      const revokedAt = new Date();
      const revoked = await prisma.$transaction(async (tx) => {
        const current = await tx.submission.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            grantee: {
              select: {
                id: true,
                status: true,
                user: { select: { id: true, email: true, fullName: true, role: true } },
              },
            },
          },
        });
        if (!current) throw new Error("Submission not found");
        if (current.grantee.status === "GRADUATED") throw new Error("GRADUATED_SUBMISSION_ARCHIVED");
        if (current.grantee.status === "REMOVED") throw new Error("GRANTEE_ALREADY_REMOVED");

        const updatedGrantee = await tx.grantee.update({
          where: { id: current.grantee.id },
          data: {
            status: "REMOVED",
            dateRemoved: revokedAt,
            remarks: revocationReason,
          },
        });
        await downgradeInactiveGranteeRole(tx, current.grantee.user.id);
        const updatedSubmission = await tx.submission.update({
          where: { id },
          data: {
            status: "REMOVED",
            reviewNotes: revocationReason,
            reviewedAt: revokedAt,
            reviewedById: appUser.id,
          },
        });

        await writeAuditLog(tx, {
          action: "GRANTEE_STATUS_CHANGED",
          actorId: appUser.id,
          targetTable: "grantees",
          targetId: current.grantee.id,
          beforeData: { status: current.grantee.status },
          afterData: {
            status: updatedGrantee.status,
            dateRemoved: updatedGrantee.dateRemoved,
            userRole: "YOUTH",
          },
          metadata: {
            reason: revocationReason,
            submissionId: id,
            targetEmail: current.grantee.user.email,
            previousUserRole: current.grantee.user.role,
            userRole: "YOUTH",
          },
          meta: {
            reason: revocationReason,
            submissionId: id,
            target: current.grantee.user.fullName,
          },
        });

        return {
          submission: updatedSubmission,
          recipient: current.grantee.user,
        };
      });

      const subject = "SKEAP scholarship status update";
      const bodyText = [
        `Hello ${revoked.recipient.fullName},`,
        "",
        "Your SKEAP scholarship has been revoked and your grantee status has been marked as Removed.",
        "",
        `Reason for revocation: ${revocationReason}`,
        "",
        "Your record has been transferred to the Past Grantees archive. Please contact the SKEAP administration if you have questions about this decision.",
        "",
        "SKEAP Administration",
      ].join("\n");
      await refreshInactiveGranteesView();
      const transporter = createGmailTransporter();
      await sendTransactionalEmail(
        transporter,
        revoked.recipient.email,
        subject,
        bodyText,
        `revocation-${id}`,
      );

      return NextResponse.json({ success: true, submission: revoked.submission });
    }
    const existingDocumentStatus =
      documentType === "coe" ? existing.coeStatus : existing.gradesStatus;
    if (existingDocumentStatus === "APPROVED" && action !== "RETURN_FOR_UPDATE") {
      return NextResponse.json(
        { error: "This document has already been approved and cannot be changed." },
        { status: 409 }
      );
    }

    let flaggedFields: string[] = Array.isArray(existing.flaggedFields)
      ? (existing.flaggedFields as string[])
      : [];
    let coeStatus = existing.coeStatus;
    let gradesStatus = existing.gradesStatus;
    const reviewedAt = new Date();
    const newReviewNotes = action === "RETURN_FOR_UPDATE" ? reviewNotes : null;

    if (documentType === "coe") {
      if (action === "APPROVE") {
        flaggedFields = flaggedFields.filter((field) => field !== "COE");
        coeStatus = "APPROVED";
      } else {
        if (!flaggedFields.includes("COE")) {
          flaggedFields = [...flaggedFields, "COE"];
        }
        coeStatus = "RETURNED_FOR_EDIT";
      }
    } else if (documentType === "grades") {
      if (action === "APPROVE") {
        flaggedFields = flaggedFields.filter((field) => field !== "GRADE_REPORT");
        gradesStatus = "APPROVED";
      } else {
        if (!flaggedFields.includes("GRADE_REPORT")) {
          flaggedFields = [...flaggedFields, "GRADE_REPORT"];
        }
        gradesStatus = "RETURNED_FOR_EDIT";
      }
    }

    const newStatus: Prisma.SubmissionUpdateInput["status"] =
      coeStatus === "APPROVED" && gradesStatus === "APPROVED"
        ? "APPROVED"
        : coeStatus === "RETURNED_FOR_EDIT" || gradesStatus === "RETURNED_FOR_EDIT"
          ? "RETURNED_FOR_EDIT"
          : "PENDING";

    const updateData: Prisma.SubmissionUpdateInput = {
      status: newStatus,
      coeStatus,
      gradesStatus,
      ...(documentType === "coe" ? { coeApprovedAt: action === "APPROVE" ? reviewedAt : null } : {}),
      ...(documentType === "grades" ? { gradesApprovedAt: action === "APPROVE" ? reviewedAt : null } : {}),
      reviewNotes: newReviewNotes,
      flaggedFields,
      reviewedAt,
      reviewedById: appUser.id,
    };

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.submission.findUnique({
        where: { id },
        select: { grantee: { select: { status: true } } },
      });
      if (current?.grantee.status === "GRADUATED") throw new Error("GRADUATED_SUBMISSION_ARCHIVED");

      const saved = await tx.submission.update({
        where: { id },
        data: updateData,
      });
      const flaggedField = documentType === "coe" ? "COE" : "GRADE_REPORT";
      const manualOverride =
        action === "APPROVE" &&
        Array.isArray(existing.flaggedFields) &&
        existing.flaggedFields.includes(flaggedField);

      await writeAuditLog(tx, {
        action: manualOverride
          ? "DOCUMENT_OVERRIDDEN"
          : action === "APPROVE"
            ? "DOCUMENT_REVIEWED"
            : "FLAG_SUBMISSION_FOR_CORRECTION",
        actorId: appUser.id,
        targetTable: "submissions",
        targetId: id,
        beforeData: {
          status: existing.status,
          flaggedFields: existing.flaggedFields ?? [],
          reviewNotes: existing.reviewNotes ?? null,
        },
        afterData: {
          status: saved.status,
          flaggedFields,
          reviewNotes: saved.reviewNotes ?? null,
        },
        metadata: {
          documentType,
          manualOverride,
          systemFlagged: manualOverride,
          reviewResult: action,
          reason: action === "RETURN_FOR_UPDATE" ? reviewNotes : undefined,
          target: existing.grantee ? `Submission ${id}` : `Submission ${id}`,
          targetId: id,
          targetEmail: undefined,
        },
        meta: {
          documentType,
          reason: action === "RETURN_FOR_UPDATE" ? reviewNotes : undefined,
          target: `Submission ${id}`,
          targetId: id,
        },
      });

      return saved;
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to review submission";
    if (message === "GRADUATED_SUBMISSION_ARCHIVED") {
      return NextResponse.json({ error: "Graduated scholar submissions are locked for statutory retention." }, { status: 409 });
    }
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
