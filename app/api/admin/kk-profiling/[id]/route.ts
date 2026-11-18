import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { createGmailTransporter, sendTransactionalEmail } from "@/lib/broadcast-email";
import { formatSexLabel, parseSex } from "@/lib/sex";
import { syncKkProfileFromLatestRegistration } from "@/lib/kk-profile-sync";
import { sweepAgedOutKkProfiles } from "@/lib/archiveAgedOutMembers";
import { refreshKkProfilingApplicationsAdminView } from "@/lib/application-admin-view-refresh";

function normalizeReviewStatus(value: string) {
  return value.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

async function authorizeUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const appUser = await ensureProfile(user);

  if (!appUser) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Only SK officials can edit profiling registrations" },
        { status: 403 }
      ),
    };
  }

  return { user: appUser };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorizeUser();
    if (auth.error) {
      return auth.error;
    }

    const registration = await prisma.profilingRegistration.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            kkProfile: {
              select: {
                fullName: true,
                firstName: true,
                middleName: true,
                lastName: true,
                purok: true,
                addressLine: true,
                barangay: true,
                birthDate: true,
                placeOfBirth: true,
                contactNumber: true,
                sex: true,
                email: true,
              },
            },
            grantee: {
              select: { id: true, status: true, remarks: true },
            },
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const { user, ...registrationDetails } = registration;
    return NextResponse.json({
      ...registrationDetails,
      kkProfile: user?.kkProfile ?? null,
      user: user
        ? {
            grantee: user.grantee,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to load profiling registration details:", error);
    return NextResponse.json(
      { error: "Failed to load profiling registration details." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authorizeUser();
    if (auth.error) {
      return auth.error;
    }

    const payload = await req.json();

    const {
      fullName,
      address,
      sex,
      age,
      birthDate,
      email,
      facebook,
      contactNumber,
      civilStatus,
      youthClassification,
      youthAgeGroup,
      workStatus,
      educationalBackground,
      registeredSKVoter,
      votedLastSK,
      registeredNationalVoter,
      attendedKKAssembly,
      assemblyTimes,
      noAssemblyReason,
      consent,
      reviewStatus,
      reviewNotes,
      reviewAction,
    } = payload;

    const registration = await prisma.profilingRegistration.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, emailNotifications: true } },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    if (fullName !== undefined && !fullName?.trim()) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (address !== undefined && !address?.trim()) {
      return NextResponse.json({ error: "Address is required." }, { status: 400 });
    }
    if (email !== undefined && !email?.trim()) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    const parsedSex = sex === undefined ? null : parseSex(sex);
    if (sex !== undefined && !parsedSex) {
      return NextResponse.json({ error: "Sex must be Male, Female, or Not specified." }, { status: 400 });
    }
    if (
      typeof reviewStatus === "string" &&
      normalizeReviewStatus(reviewStatus) === "rejected" &&
      (typeof reviewNotes !== "string" || !reviewNotes.trim())
    ) {
      return NextResponse.json(
        { error: "A rejection reason is required so the applicant understands the decision." },
        { status: 400 }
      );
    }

    const currentStatus = normalizeReviewStatus(registration.reviewStatus);
    const requestedStatus = typeof reviewStatus === "string"
      ? normalizeReviewStatus(reviewStatus)
      : currentStatus;
    const reviewActionKey = typeof reviewAction === "string" ? reviewAction : null;
    const actionStatuses: Record<string, string> = {
      PASS_DIGITAL_REVIEW: "for physical ctc",
      CONFIRM_PHYSICAL_CTC: "approved",
      RETURN_FOR_EDITS: "returned",
      REOPEN: "returned",
    };

    if (reviewActionKey && !actionStatuses[reviewActionKey]) {
      return NextResponse.json({ error: "Unsupported KK Profiling review action." }, { status: 400 });
    }
    if (reviewActionKey && actionStatuses[reviewActionKey] !== requestedStatus) {
      return NextResponse.json({ error: "The requested review action and status do not match." }, { status: 400 });
    }
    if (
      reviewActionKey === "RETURN_FOR_EDITS" &&
      (typeof reviewNotes !== "string" || !reviewNotes.trim())
    ) {
      return NextResponse.json(
        { error: "Correction notes are required before returning an application." },
        { status: 400 },
      );
    }
    if (
      !reviewActionKey &&
      requestedStatus !== currentStatus &&
      ["approved", "for physical ctc", "returned"].includes(requestedStatus)
    ) {
      return NextResponse.json(
        { error: "Use the review action controls to change this application’s review stage." },
        { status: 409 },
      );
    }
    if (
      reviewActionKey === "PASS_DIGITAL_REVIEW" &&
      !["pending", "pending review", "manual review", "resubmitted"].includes(currentStatus)
    ) {
      return NextResponse.json({ error: "Only pending or resubmitted registrations can pass digital review." }, { status: 409 });
    }
    if (reviewActionKey === "CONFIRM_PHYSICAL_CTC" && currentStatus !== "for physical ctc") {
      return NextResponse.json({ error: "Physical CTC confirmation is only available after digital review." }, { status: 409 });
    }
    if (
      reviewActionKey === "RETURN_FOR_EDITS" &&
      !["pending", "pending review", "manual review", "resubmitted"].includes(currentStatus)
    ) {
      return NextResponse.json(
        { error: "This registration is not awaiting digital review and cannot be returned again." },
        { status: 409 },
      );
    }
    if (reviewActionKey === "REOPEN" && currentStatus !== "rejected") {
      return NextResponse.json({ error: "Only rejected applications can be reopened." }, { status: 409 });
    }

    const nextReviewStatus = reviewActionKey
      ? reviewActionKey === "PASS_DIGITAL_REVIEW"
        ? "For Physical CTC"
        : reviewActionKey === "CONFIRM_PHYSICAL_CTC"
          ? "Approved"
          : "Returned"
      : reviewStatus;

    const transactionResult = await prisma.$transaction(async (tx) => {
      const updateData = {
          fullName: fullName !== undefined ? fullName.trim() : registration.fullName,
          address: address !== undefined ? address.trim() : registration.address,
          sex: parsedSex ? formatSexLabel(parsedSex) : registration.sex,
          age: age !== undefined ? Number(age ?? registration.age) : registration.age,
          birthDate: birthDate !== undefined ? new Date(birthDate) : registration.birthDate,
          email: email !== undefined ? email.trim() : registration.email,
          facebook: facebook !== undefined ? facebook?.trim() ?? registration.facebook : registration.facebook,
          contactNumber:
            contactNumber !== undefined ? contactNumber?.trim() ?? registration.contactNumber : registration.contactNumber,
          civilStatus:
            civilStatus !== undefined ? civilStatus?.trim() ?? registration.civilStatus : registration.civilStatus,
          youthClassification:
            youthClassification !== undefined
              ? youthClassification?.trim() ?? registration.youthClassification
              : registration.youthClassification,
          youthAgeGroup:
            youthAgeGroup !== undefined
              ? youthAgeGroup?.trim() ?? registration.youthAgeGroup
              : registration.youthAgeGroup,
          workStatus: workStatus !== undefined ? workStatus?.trim() ?? registration.workStatus : registration.workStatus,
          educationalBackground:
            educationalBackground !== undefined
              ? educationalBackground?.trim() ?? registration.educationalBackground
              : registration.educationalBackground,
          registeredSKVoter:
            registeredSKVoter !== undefined
              ? registeredSKVoter?.trim() ?? registration.registeredSKVoter
              : registration.registeredSKVoter,
          votedLastSK:
            votedLastSK !== undefined ? votedLastSK?.trim() ?? registration.votedLastSK : registration.votedLastSK,
          registeredNationalVoter:
            registeredNationalVoter !== undefined
              ? registeredNationalVoter?.trim() ?? registration.registeredNationalVoter
              : registration.registeredNationalVoter,
          attendedKKAssembly:
            attendedKKAssembly !== undefined
              ? attendedKKAssembly?.trim() ?? registration.attendedKKAssembly
              : registration.attendedKKAssembly,
          assemblyTimes:
            assemblyTimes !== undefined
              ? assemblyTimes?.trim() ?? registration.assemblyTimes
              : registration.assemblyTimes,
          noAssemblyReason:
            noAssemblyReason !== undefined
              ? noAssemblyReason?.trim() ?? registration.noAssemblyReason
              : registration.noAssemblyReason,
          consent: typeof consent === "boolean" ? consent : registration.consent,
          reviewStatus: nextReviewStatus !== undefined ? nextReviewStatus?.trim() ?? registration.reviewStatus : registration.reviewStatus,
          reviewNotes:
            reviewNotes !== undefined
              ? reviewNotes?.trim() || null
              : registration.reviewNotes,
        };
      const transition = await tx.profilingRegistration.updateMany({
        where: { id, reviewStatus: registration.reviewStatus },
        data: updateData,
      });
      if (transition.count !== 1) throw new Error("KK_PROFILING_REVIEW_STATE_CHANGED");
      const saved = await tx.profilingRegistration.findUniqueOrThrow({ where: { id } });

      if (registration.userId) {
        await syncKkProfileFromLatestRegistration(tx, registration.userId);
      }

      const isReturnedForEdits =
        requestedStatus === "returned" &&
        currentStatus !== "returned" &&
        (reviewActionKey === "RETURN_FOR_EDITS" || reviewActionKey === "REOPEN");

      if (isReturnedForEdits && registration.userId) {
        const message = await tx.granteeMessage.create({
          data: {
            userId: registration.userId,
            senderId: auth.user.id,
            subject: "KK Profiling application returned for edits",
            body: `Your KK Profiling application was returned for edits.\n\nCorrection notes from the reviewer:\n${saved.reviewNotes || "Please review and update your application."}`,
          },
        });

        await tx.notification.create({
          data: {
            userId: registration.userId,
            sourceKey: `message:${message.id}`,
          },
        });
      }

      const stageMessage = reviewActionKey === "PASS_DIGITAL_REVIEW"
        ? {
            subject: "KK Profiling: Physical CTC Verification Required",
            body: "Your digital KK Profiling screening is complete. Please bring the Original or Certified True Copy (CTC) of your supporting document to the Barangay Pico SK Office for in-person verification.",
          }
        : reviewActionKey === "CONFIRM_PHYSICAL_CTC"
          ? {
              subject: "KK Profiling Application Approved",
              body: "Your physical Original / CTC verification is complete. Your KK Profiling application has been approved and your profile is now verified.",
            }
          : null;

      if (stageMessage && registration.userId) {
        const message = await tx.granteeMessage.create({
          data: {
            userId: registration.userId,
            senderId: auth.user.id,
            subject: stageMessage.subject,
            body: stageMessage.body,
          },
        });
        await tx.notification.create({
          data: {
            userId: registration.userId,
            sourceKey: `message:${message.id}`,
            message: `${stageMessage.subject}\n${stageMessage.body}`,
          },
        });
      }

      await writeAuditLog(tx, {
        action: reviewActionKey === "PASS_DIGITAL_REVIEW"
          ? "KK_PROFILING_DIGITAL_REVIEW_PASSED"
          : reviewActionKey === "CONFIRM_PHYSICAL_CTC"
            ? "KK_PROFILING_PHYSICAL_CTC_CONFIRMED"
            : reviewActionKey === "RETURN_FOR_EDITS"
              ? "KK_PROFILING_APPLICATION_RETURNED"
              : requestedStatus === "rejected"
                ? "KK_PROFILING_APPLICATION_REJECTED"
                : "MANUAL_PROFILE_UPDATE",
        actorId: auth.user.id,
        targetTable: "kk_profiling_registrations",
        targetId: id,
        beforeData: { ...registration },
        afterData: { ...saved },
        metadata: {
          target: saved.fullName,
          targetEmail: saved.email,
          targetId: id,
          changedFields: Object.keys(payload).filter((key) => payload[key] !== undefined),
          ...(requestedStatus === "rejected"
            ? { reason: saved.reviewNotes }
            : {}),
        },
      });

      return {
        saved,
        stageNotification: stageMessage
          ? {
              ...stageMessage,
              referenceId: `kk-profiling-${id}-${reviewActionKey?.toLowerCase() ?? "review"}`,
            }
          : null,
      };
    });

    if (birthDate !== undefined) {
      await sweepAgedOutKkProfiles(auth.user.id, "profile-save", {
        resubmittedRegistrationId:
          registration.reviewStatus === "Approved" &&
          normalizeReviewStatus(transactionResult.saved.reviewStatus) === "resubmitted"
            ? id
            : undefined,
      });
    }

    await refreshKkProfilingApplicationsAdminView();
    revalidatePath("/admin");
    if (
      transactionResult.stageNotification &&
      registration.user?.emailNotifications !== false
    ) {
      try {
        const transporter = createGmailTransporter();
        await sendTransactionalEmail(
          transporter,
          registration.user?.email ?? registration.email,
          transactionResult.stageNotification.subject,
          transactionResult.stageNotification.body,
          transactionResult.stageNotification.referenceId,
        );
      } catch (error) {
        console.error(
          `KK Profiling status updated, but email notification failed for ${registration.id}:`,
          error,
        );
      }
    }
    const savedRegistration = birthDate !== undefined
      ? await prisma.profilingRegistration.findUniqueOrThrow({ where: { id } })
      : transactionResult.saved;
    return NextResponse.json(savedRegistration);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to update profiling registration:", errorMessage, error);
    if (errorMessage === "KK_PROFILING_REVIEW_STATE_CHANGED") {
      return NextResponse.json(
        { error: "The application status changed. Refresh the review queue and try again." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to update profiling registration", details: errorMessage },
      { status: 500 }
    );
  }
}
