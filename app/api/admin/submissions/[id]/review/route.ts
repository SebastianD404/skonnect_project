import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { hasGranteeColumn, prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { refreshInactiveGranteesView } from "@/lib/grantee-archive-view";
import { downgradeInactiveGranteeRole } from "@/lib/grantee-role";
import {
  getSkeapRevocationReasonLabel,
  isSkeapRevocationReason,
} from "@/lib/skeap-revocation";
import { sendSkeapRevocationEmail } from "@/lib/skeap-revocation-email";
import { notifyGranteesToUploadRequirements } from "@/lib/grantee-notifications";
import { notifyGranteePhysicalCtcStatus } from "@/lib/grantee-submission-notifications";
import { getGranteeGraduationProgress } from "@/lib/grantee-graduation-readiness";
import { dispatchWaitlistSlotOffers } from "@/lib/skeap-waitlist-offers";
import {
  buildIdentityFingerprint,
  parseSkeapApplicantName,
} from "@/lib/skeap-application-guard";

type ReviewAction =
  | "APPROVE"
  | "RETURN_FOR_UPDATE"
  | "REVOKE"
  | "VERIFY_DIGITAL"
  | "CONFIRM_PHYSICAL_CTC";
type DocumentType = "coe" | "grades";

type ReviewBody = {
  documentType?: DocumentType;
  action?: ReviewAction;
  reviewNotes?: string;
  flaggedFields?: string[];
  reason?: string;
  additionalNotes?: string;
  isPermanentlyDisqualified?: boolean;
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
    const revocationReasonValue = String(body.reason ?? "").trim();
    const additionalNotes = String(body.additionalNotes ?? "").trim();
    const isPermanentlyDisqualified = body.isPermanentlyDisqualified === true;
    const revocationReasonOption = isSkeapRevocationReason(revocationReasonValue)
      ? getSkeapRevocationReasonLabel(revocationReasonValue)
      : "";
    const revocationReason = additionalNotes
      ? `${revocationReasonOption}\nAdditional Notes: ${additionalNotes}`
      : revocationReasonOption;

    if (
      action !== "APPROVE" &&
      action !== "RETURN_FOR_UPDATE" &&
      action !== "REVOKE" &&
      action !== "VERIFY_DIGITAL" &&
      action !== "CONFIRM_PHYSICAL_CTC"
    ) {
      return NextResponse.json({ error: "Invalid review action" }, { status: 400 });
    }

    const isPhysicalVerificationAction =
      action === "VERIFY_DIGITAL" || action === "CONFIRM_PHYSICAL_CTC";
    if (!isPhysicalVerificationAction && action !== "REVOKE" && documentType !== "coe" && documentType !== "grades") {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }

    if (action === "RETURN_FOR_UPDATE" && !reviewNotes) {
      return NextResponse.json(
        { error: "Review notes are required when returning a document for correction." },
        { status: 400 }
      );
    }
    if (
      action === "REVOKE" &&
      (revocationReasonValue.length < 5 || !isSkeapRevocationReason(revocationReasonValue))
    ) {
      return NextResponse.json({ error: "Select a valid reason for revocation." }, { status: 400 });
    }
    if (action === "REVOKE" && additionalNotes.length > 1000) {
      return NextResponse.json({ error: "Additional notes must be 1,000 characters or fewer." }, { status: 400 });
    }
    if (
      action === "REVOKE" &&
      body.isPermanentlyDisqualified !== undefined &&
      typeof body.isPermanentlyDisqualified !== "boolean"
    ) {
      return NextResponse.json({ error: "Permanent disqualification must be a boolean value." }, { status: 400 });
    }

    const existing = await prisma.submission.findUnique({
      where: { id },
      select: {
        id: true,
        semester: true,
        coeFileUrl: true,
        gradeFileUrl: true,
        flaggedFields: true,
        status: true,
        coeStatus: true,
        gradesStatus: true,
        reviewNotes: true,
        grantee: {
          select: {
            id: true,
            status: true,
            userId: true,
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (existing.grantee?.status === "GRADUATED") {
      return NextResponse.json({ error: "Graduated scholar submissions are locked for statutory retention." }, { status: 409 });
    }
    if (existing.status === "AWAITING_PHYSICAL_CTC" && action === "APPROVE") {
      return NextResponse.json(
        { error: "This submission is awaiting physical Original / CTC verification." },
        { status: 409 }
      );
    }
    if (action === "VERIFY_DIGITAL") {
      if (existing.status !== "PENDING") {
        return NextResponse.json({ error: "Only pending submissions can enter physical verification." }, { status: 409 });
      }
      if (
        !existing.coeFileUrl ||
        !existing.gradeFileUrl ||
        existing.coeStatus !== "APPROVED" ||
        existing.gradesStatus !== "APPROVED" ||
        existing.flaggedFields.length > 0
      ) {
        return NextResponse.json(
          { error: "Approve both digital documents and clear all correction flags before requesting physical verification." },
          { status: 409 }
        );
      }

      const reviewedAt = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        const transition = await tx.submission.updateMany({
          where: {
            id,
            status: "PENDING",
            coeStatus: "APPROVED",
            gradesStatus: "APPROVED",
            flaggedFields: { isEmpty: true },
          },
          data: {
            status: "AWAITING_PHYSICAL_CTC",
            reviewedById: appUser.id,
            reviewedAt,
            physicalVerifiedBy: null,
            physicalVerifiedAt: null,
          },
        });
        if (transition.count !== 1) throw new Error("SUBMISSION_REVIEW_STATE_CHANGED");
        const saved = await tx.submission.findUniqueOrThrow({ where: { id } });
        await writeAuditLog(tx, {
          action: "DOCUMENT_REVIEWED",
          actorId: appUser.id,
          targetTable: "submissions",
          targetId: id,
          beforeData: { status: existing.status },
          afterData: { status: saved.status, reviewedById: appUser.id, reviewedAt },
          metadata: { reviewResult: "VERIFY_DIGITAL", targetId: id },
          meta: { reviewResult: "VERIFY_DIGITAL", targetId: id },
        });
        return saved;
      });

      const notificationErrors = await notifyGranteePhysicalCtcStatus({
        stage: "requested",
        submissionId: id,
        userId: existing.grantee.user.id,
        email: existing.grantee.user.email,
        semester: existing.semester,
      });
      if (notificationErrors.length > 0) {
        console.error("Digital pre-check completed with notification errors:", notificationErrors);
      }
      return NextResponse.json({ success: true, submission: updated });
    }

    if (action === "CONFIRM_PHYSICAL_CTC") {
      if (existing.status !== "AWAITING_PHYSICAL_CTC") {
        return NextResponse.json({ error: "This submission is not awaiting physical CTC verification." }, { status: 409 });
      }

      const physicalVerifiedAt = new Date();
      const hasGraduationReadyAtColumn = await hasGranteeColumn("graduationReadyAt");
      const approvalResult = await prisma.$transaction(async (tx) => {
        const transition = await tx.submission.updateMany({
          where: { id, status: "AWAITING_PHYSICAL_CTC" },
          data: {
            status: "APPROVED",
            physicalVerifiedBy: appUser.id,
            physicalVerifiedAt,
            reviewedById: appUser.id,
            reviewedAt: physicalVerifiedAt,
          },
        });
        if (transition.count !== 1) throw new Error("SUBMISSION_REVIEW_STATE_CHANGED");
        const saved = await tx.submission.findUniqueOrThrow({ where: { id } });
        const grantee = await tx.grantee.findUniqueOrThrow({
          where: { id: existing.grantee.id },
          select: {
            id: true,
            status: true,
            dateEnrolled: true,
            entryAcademicYear: true,
            entrySemester: true,
            journeyStart: true,
            journeyEnd: true,
            ...(hasGraduationReadyAtColumn ? { graduationReadyAt: true } : {}),
            submissions: {
              select: {
                id: true,
                semester: true,
                status: true,
                submittedAt: true,
                reviewedAt: true,
                generalAverage: true,
                ocrGwa: true,
                reviewNotes: true,
                gradeFileUrl: true,
                coeFileUrl: true,
              },
            },
            yearLevel: true,
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        });
        const graduationProgress = getGranteeGraduationProgress({
          submissions: grantee.submissions,
          dateEnrolled: grantee.dateEnrolled,
          yearLevel: grantee.yearLevel,
          journeyStart: grantee.journeyStart,
          journeyEnd: grantee.journeyEnd,
          entryTerm: grantee.entryAcademicYear && grantee.entrySemester
            ? `${grantee.entryAcademicYear} ${grantee.entrySemester}`
            : undefined,
          now: physicalVerifiedAt,
        });
        let graduationCandidate: {
          granteeId: string;
          userId: string;
          granteeName: string;
          totalRequiredSemesters: number;
        } | null = null;
        if (
          graduationProgress.isComplete &&
          (grantee.status === "ACTIVE" || grantee.status === "PROBATIONARY") &&
          (!hasGraduationReadyAtColumn ||
            !("graduationReadyAt" in grantee) ||
            !grantee.graduationReadyAt)
        ) {
          const readinessTransition = hasGraduationReadyAtColumn
            ? await tx.grantee.updateMany({
                where: {
                  id: grantee.id,
                  status: { in: ["ACTIVE", "PROBATIONARY"] },
                  graduationReadyAt: null,
                },
                data: { graduationReadyAt: physicalVerifiedAt },
              })
            : { count: 1 };
          if (readinessTransition.count === 1) {
            graduationCandidate = {
              granteeId: grantee.id,
              userId: grantee.user.id,
              granteeName: grantee.user.fullName,
              totalRequiredSemesters: graduationProgress.totalRequiredSemesters,
            };
          }
        }

        if (graduationCandidate) {
          const sourceKey = `graduation-candidate-ready:${grantee.id}`;
          const adminTitle = `Graduation Candidate Ready: ${grantee.user.fullName}`;
          const adminMessage = `${grantee.user.fullName} has completed all ${graduationProgress.totalRequiredSemesters} semesters of their SKEAP Academic Journey and is now ready for Exit Clearance verification.`;
          const scholarTitle = "Congratulations! All Semesters Validated — Submit Your Exit Clearance";
          const scholarMessage = `You have completed all ${graduationProgress.totalRequiredSemesters} semesters of your SKEAP journey! Please upload your School Exit Clearance or Certificate of Graduation (or present it at the Barangay Pico SK Office) to finalize your graduation.`;

          await tx.adminNotification.upsert({
            where: { sourceKey },
            create: {
              sourceKey,
              title: adminTitle,
              message: adminMessage,
              type: "GRADUATION_CANDIDATE_READY",
            },
            update: {
              title: adminTitle,
              message: adminMessage,
            },
          });
          await tx.notification.upsert({
            where: {
              userId_sourceKey: {
                userId: grantee.user.id,
                sourceKey,
              },
            },
            create: {
              userId: grantee.user.id,
              sourceKey,
              message: `${scholarTitle}\n${scholarMessage}`,
            },
            update: {
              message: `${scholarTitle}\n${scholarMessage}`,
              isRead: false,
              readAt: null,
            },
          });
        }

        await writeAuditLog(tx, {
          action: "DOCUMENT_REVIEWED",
          actorId: appUser.id,
          targetTable: "submissions",
          targetId: id,
          beforeData: { status: existing.status },
          afterData: {
            status: saved.status,
            physicalVerifiedBy: appUser.id,
            physicalVerifiedAt,
          },
          metadata: { reviewResult: "CONFIRM_PHYSICAL_CTC", targetId: id },
          meta: { reviewResult: "CONFIRM_PHYSICAL_CTC", targetId: id },
        });
        return { submission: saved, graduationCandidate };
      });

      const notificationErrors = await notifyGranteePhysicalCtcStatus({
        stage: "approved",
        submissionId: id,
        userId: existing.grantee.user.id,
        email: existing.grantee.user.email,
        semester: existing.semester,
      });
      if (notificationErrors.length > 0) {
        console.error("Physical CTC approval completed with notification errors:", notificationErrors);
      }
      if (!approvalResult.graduationCandidate) {
        try {
          const nextTermResult = await notifyGranteesToUploadRequirements({
            targetUserIds: [existing.grantee.userId],
            trigger: "REQUIREMENT_APPROVED",
          });
          if (nextTermResult.errors.length > 0) {
            console.error("Physical CTC approval completed with next-term notification errors:", nextTermResult.errors);
          }
        } catch (error) {
          console.error("Physical CTC approval completed, but next-term notifications failed:", error);
        }
      }
      return NextResponse.json({
        success: true,
        submission: approvalResult.submission,
        graduationCandidate: approvalResult.graduationCandidate
          ? { ready: true, totalRequiredSemesters: approvalResult.graduationCandidate.totalRequiredSemesters }
          : null,
      });
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
                user: {
                  select: {
                    id: true,
                    email: true,
                    fullName: true,
                    role: true,
                    kkProfile: {
                      select: {
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        birthDate: true,
                      },
                    },
                    skeapApplications: {
                      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
                      take: 1,
                      select: { applicantName: true, dateOfBirth: true },
                    },
                  },
                },
              },
            },
          },
        });
        if (!current) throw new Error("Submission not found");
        if (current.grantee.status === "GRADUATED") throw new Error("GRADUATED_SUBMISSION_ARCHIVED");
        if (current.grantee.status === "REMOVED" || current.grantee.status === "REVOKED") {
          throw new Error("GRANTEE_ALREADY_REVOKED");
        }

        const latestApplication = current.grantee.user.skeapApplications?.[0];
        const applicationName = parseSkeapApplicantName(latestApplication?.applicantName);
        const profileName = parseSkeapApplicantName(current.grantee.user.fullName);
        const identityFingerprint = buildIdentityFingerprint({
          firstName:
            current.grantee.user.kkProfile?.firstName ??
            applicationName?.firstName ??
            profileName?.firstName,
          middleName:
            current.grantee.user.kkProfile?.middleName ??
            applicationName?.middleName ??
            profileName?.middleName,
          lastName:
            current.grantee.user.kkProfile?.lastName ??
            applicationName?.lastName ??
            profileName?.lastName,
          dateOfBirth:
            current.grantee.user.kkProfile?.birthDate ??
            latestApplication?.dateOfBirth,
        })?.exact ?? null;

        const updatedGrantee = await tx.grantee.update({
          where: { id: current.grantee.id },
          data: {
            status: "REVOKED",
            dateRemoved: revokedAt,
            remarks: revocationReason,
            revocationReason: revocationReasonOption,
            revocationNotes: additionalNotes || null,
            isPermanentlyDisqualified,
            identityFingerprint,
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
            revocationReason: updatedGrantee.revocationReason,
            revocationNotes: updatedGrantee.revocationNotes,
            isPermanentlyDisqualified: updatedGrantee.isPermanentlyDisqualified,
            userRole: "YOUTH",
          },
          metadata: {
            reason: revocationReason,
            isPermanentlyDisqualified,
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

      await refreshInactiveGranteesView();
      await sendSkeapRevocationEmail({
        granteeId: revoked.recipient.id,
        recipient: revoked.recipient,
        reason: revocationReasonOption,
        additionalNotes: additionalNotes || null,
      });

      try {
        await dispatchWaitlistSlotOffers();
      } catch (offerError) {
        console.error("SKEAP grantee was revoked, but waitlist offers could not be dispatched:", offerError);
        return NextResponse.json(
          { error: "Revocation was recorded, but waitlist offers could not be dispatched. Retry Notify Next Eligible on the waitlist page." },
          { status: 503 },
        );
      }

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
      coeStatus === "RETURNED_FOR_EDIT" || gradesStatus === "RETURNED_FOR_EDIT"
        ? "RETURNED_FOR_EDIT"
        : "PENDING";

    const updateData: Prisma.SubmissionUpdateInput = {
      status: newStatus,
      coeStatus,
      gradesStatus,
      ...(documentType === "coe" ? { coeApprovedAt: action === "APPROVE" ? reviewedAt : null } : {}),
      ...(documentType === "grades" ? { gradesApprovedAt: action === "APPROVE" ? reviewedAt : null } : {}),
      ...(documentType === "grades" && action === "APPROVE"
        ? { requiresStrictManualReview: false }
        : {}),
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

      const transition = await tx.submission.updateMany({
        where: {
          id,
          status: existing.status,
          coeStatus: existing.coeStatus,
          gradesStatus: existing.gradesStatus,
          flaggedFields: { equals: existing.flaggedFields },
        },
        data: updateData,
      });
      if (transition.count !== 1) throw new Error("SUBMISSION_REVIEW_STATE_CHANGED");
      const saved = await tx.submission.findUniqueOrThrow({ where: { id } });
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
    if (message === "GRANTEE_ALREADY_REVOKED") {
      return NextResponse.json({ error: "This grantee has already been removed or revoked." }, { status: 409 });
    }
    if (message === "SUBMISSION_REVIEW_STATE_CHANGED") {
      return NextResponse.json(
        { error: "The submission status changed. Refresh the review queue and try again." },
        { status: 409 }
      );
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
