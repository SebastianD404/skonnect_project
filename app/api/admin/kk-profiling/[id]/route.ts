import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { formatSexLabel, parseSex } from "@/lib/sex";
import { syncKkProfileFromLatestRegistration } from "@/lib/kk-profile-sync";

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
    } = payload;

    const registration = await prisma.profilingRegistration.findUnique({
      where: { id },
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
      reviewStatus.trim().toLowerCase() === "rejected" &&
      (typeof reviewNotes !== "string" || !reviewNotes.trim())
    ) {
      return NextResponse.json(
        { error: "A rejection reason is required so the applicant understands the decision." },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.profilingRegistration.update({
        where: { id },
        data: {
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
          reviewStatus: reviewStatus !== undefined ? reviewStatus?.trim() ?? registration.reviewStatus : registration.reviewStatus,
          reviewNotes:
            reviewNotes !== undefined
              ? reviewNotes?.trim() || null
              : registration.reviewNotes,
        },
      });

      if (registration.userId) {
        await syncKkProfileFromLatestRegistration(tx, registration.userId);
      }

      const isReturnedForEdits =
        typeof reviewStatus === "string" &&
        reviewStatus.trim().toLowerCase() === "returned" &&
        (registration.reviewStatus.trim().toLowerCase() !== "returned" ||
          saved.reviewNotes !== registration.reviewNotes);

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

      await writeAuditLog(tx, {
        action:
          typeof reviewStatus === "string" && reviewStatus.trim().toLowerCase() === "rejected"
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
          ...(typeof reviewStatus === "string" && reviewStatus.trim().toLowerCase() === "rejected"
            ? { reason: saved.reviewNotes }
            : {}),
        },
      });

      return saved;
    });

    return NextResponse.json(updated);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to update profiling registration:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to update profiling registration", details: errorMessage },
      { status: 500 }
    );
  }
}
