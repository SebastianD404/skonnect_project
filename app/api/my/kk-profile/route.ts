import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getKKProfilingReviewStatus } from "@/lib/kk-profiling-review";
import { databaseUnavailableResponse } from "@/lib/database-errors";
import { KK_MEMBER_AGE_OUT_REASON } from "@/lib/kk-member-archive";

function computeAge(birthDate: Date) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();

  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  let age = currentYear - birthYear;
  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth && currentDay < birthDay)
  ) {
    age -= 1;
  }
  return age;
}

export async function GET() {
  try {
    return await getKKProfile();
  } catch (error) {
    const unavailable = databaseUnavailableResponse(error, "GET /api/my/kk-profile");
    if (unavailable) return unavailable;
    throw error;
  }
}

async function getKKProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return NextResponse.json({
      profile: null,
      hasVerifiedKkProfile: false,
      requiresKkProfiling: true,
    });
  }

  const [profile, latestRegistration, ageOutRegistration] = await Promise.all([
    prisma.user.findUnique({
      where: { id: appUser.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        kkProfile: {
          select: {
            id: true,
            middleName: true,
            fullName: true,
            purok: true,
            addressLine: true,
            barangay: true,
            birthDate: true,
            placeOfBirth: true,
            contactNumber: true,
            email: true,
            isVerified: true,
          },
        },
      },
    }),
    prisma.profilingRegistration.findFirst({
      where: { userId: appUser.id, program: "KK" },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        fullName: true,
        address: true,
        sex: true,
        age: true,
        birthDate: true,
        email: true,
        facebook: true,
        contactNumber: true,
        civilStatus: true,
        youthClassification: true,
        youthAgeGroup: true,
        workStatus: true,
        educationalBackground: true,
        registeredSKVoter: true,
        votedLastSK: true,
        registeredNationalVoter: true,
        attendedKKAssembly: true,
        assemblyTimes: true,
        noAssemblyReason: true,
        reviewStatus: true,
        reviewNotes: true,
        withdrawnAt: true,
        withdrawalReason: true,
        submittedAt: true,
        idDocumentType: true,
        idFrontFileUrl: true,
        idBackFileUrl: true,
        idSingleFileUrl: true,
        photoFileUrl: true,
        birthCertificateFileUrl: true,
      },
    }),
    prisma.profilingRegistration.findFirst({
      where: {
        userId: appUser.id,
        program: "KK",
        archivedReason: {
          in: [KK_MEMBER_AGE_OUT_REASON, "Aged Out (31+)", "Aged Out (Turned 31)"],
        },
        archivedAt: { not: null },
      },
      orderBy: { archivedAt: "desc" },
      select: { archivedAt: true },
    }),
  ]);

  const hasApprovedRegistration =
    latestRegistration?.reviewStatus?.trim().toLowerCase() === "approved";
  const hasVerifiedKkProfile =
    Boolean(profile?.kkProfile?.isVerified) && hasApprovedRegistration;
  if (!profile?.kkProfile || !hasVerifiedKkProfile) {
    return NextResponse.json({
      profile: null,
      hasVerifiedKkProfile: false,
      requiresKkProfiling: true,
    });
  }

  const status = getKKProfilingReviewStatus(
    latestRegistration?.reviewStatus,
    profile.kkProfile.isVerified,
  );

  return NextResponse.json({
    hasVerifiedKkProfile: true,
    requiresKkProfiling: false,
    profile: {
      id: profile.kkProfile.id,
      middleName: profile.kkProfile.middleName,
      fullName: profile.kkProfile.fullName,
      email: profile.kkProfile.email || profile.email,
      contactNumber: profile.kkProfile.contactNumber || profile.phoneNumber,
      purok: profile.kkProfile.purok,
      addressLine: profile.kkProfile.addressLine,
      barangay: profile.kkProfile.barangay,
      birthDate: profile.kkProfile.birthDate,
      placeOfBirth: profile.kkProfile.placeOfBirth,
      age: computeAge(profile.kkProfile.birthDate),
      isVerified: profile.kkProfile.isVerified,
      status,
      ageOutNotice: ageOutRegistration
        ? { archivedAt: ageOutRegistration.archivedAt }
        : null,
      reviewNotes: latestRegistration?.reviewNotes ?? null,
      withdrawnAt: latestRegistration?.withdrawnAt ?? null,
      withdrawalReason: latestRegistration?.withdrawalReason ?? null,
      registrationSubmittedAt: latestRegistration?.submittedAt ?? null,
      idDocumentType: latestRegistration?.idDocumentType ?? null,
      idFrontFileUrl: latestRegistration?.idFrontFileUrl ?? null,
      idBackFileUrl: latestRegistration?.idBackFileUrl ?? null,
      idSingleFileUrl: latestRegistration?.idSingleFileUrl ?? null,
      photoFileUrl: latestRegistration?.photoFileUrl ?? null,
      birthCertificateFileUrl: latestRegistration?.birthCertificateFileUrl ?? null,
      registration: latestRegistration
        ? {
            id: latestRegistration.id,
            fullName: latestRegistration.fullName,
            address: latestRegistration.address,
            sex: latestRegistration.sex,
            age: latestRegistration.age,
            birthDate: latestRegistration.birthDate,
            email: latestRegistration.email,
            facebook: latestRegistration.facebook,
            contactNumber: latestRegistration.contactNumber,
            civilStatus: latestRegistration.civilStatus,
            youthClassification: latestRegistration.youthClassification,
            youthAgeGroup: latestRegistration.youthAgeGroup,
            workStatus: latestRegistration.workStatus,
            educationalBackground: latestRegistration.educationalBackground,
            registeredSKVoter: latestRegistration.registeredSKVoter,
            votedLastSK: latestRegistration.votedLastSK,
            registeredNationalVoter: latestRegistration.registeredNationalVoter,
            attendedKKAssembly: latestRegistration.attendedKKAssembly,
            assemblyTimes: latestRegistration.assemblyTimes,
            noAssemblyReason: latestRegistration.noAssemblyReason,
            reviewStatus: latestRegistration.reviewStatus,
            withdrawnAt: latestRegistration.withdrawnAt,
            withdrawalReason: latestRegistration.withdrawalReason,
            submittedAt: latestRegistration.submittedAt,
            idDocumentType: latestRegistration.idDocumentType,
            idFrontFileUrl: latestRegistration.idFrontFileUrl,
            idBackFileUrl: latestRegistration.idBackFileUrl,
            idSingleFileUrl: latestRegistration.idSingleFileUrl,
            photoFileUrl: latestRegistration.photoFileUrl,
            birthCertificateFileUrl: latestRegistration.birthCertificateFileUrl,
          }
        : null,
    },
  });
}
