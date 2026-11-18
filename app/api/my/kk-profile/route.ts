import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getKKProfilingReviewStatus } from "@/lib/kk-profiling-review";
import { databaseUnavailableResponse } from "@/lib/database-errors";
import { isKKMemberAgeOutReason } from "@/lib/kk-member-archive";
import { getExactAge } from "@/lib/skeap-age";

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

  const [profile, latestRegistration] = await Promise.all([
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
        middleName: true,
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
        archivedReason: true,
        archivedAt: true,
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
  ]);

  const hasArchivedNotice =
    latestRegistration?.reviewStatus?.trim().toLowerCase() === "archived";
  const hasAgeOutNotice =
    hasArchivedNotice && isKKMemberAgeOutReason(latestRegistration?.archivedReason);
  const hasApprovedRegistration =
    latestRegistration?.reviewStatus?.trim().toLowerCase() === "approved";
  const hasVerifiedKkProfile =
    Boolean(profile?.kkProfile?.isVerified) && hasApprovedRegistration;
  const kkProfile = profile?.kkProfile ?? null;

  if (!kkProfile && !latestRegistration && !hasArchivedNotice) {
    return NextResponse.json({
      profile: null,
      hasVerifiedKkProfile: false,
      requiresKkProfiling: true,
    });
  }

  const status = hasArchivedNotice
    ? "Archived"
    : getKKProfilingReviewStatus(
        latestRegistration?.reviewStatus,
        kkProfile?.isVerified ?? false,
      );

  return NextResponse.json({
    hasVerifiedKkProfile,
    requiresKkProfiling: !hasVerifiedKkProfile && !hasAgeOutNotice,
    profile: {
      id: kkProfile?.id ?? latestRegistration?.id ?? "",
      middleName: kkProfile?.middleName ?? latestRegistration?.middleName ?? null,
      fullName: kkProfile?.fullName ?? latestRegistration?.fullName ?? profile?.fullName ?? "",
      email: kkProfile?.email || latestRegistration?.email || profile?.email || "",
      contactNumber:
        kkProfile?.contactNumber ||
        latestRegistration?.contactNumber ||
        profile?.phoneNumber ||
        "",
      purok: kkProfile?.purok ?? latestRegistration?.address.split(",")[0]?.trim() ?? "",
      addressLine: kkProfile?.addressLine ?? latestRegistration?.address ?? "",
      barangay: kkProfile?.barangay ?? "Pico",
      birthDate: kkProfile?.birthDate ?? latestRegistration?.birthDate ?? null,
      placeOfBirth: kkProfile?.placeOfBirth ?? null,
      age: kkProfile
        ? getExactAge(kkProfile.birthDate) ?? 0
        : latestRegistration?.age ?? 0,
      isVerified: kkProfile?.isVerified ?? false,
      status,
      archiveNotice: hasArchivedNotice
        ? {
            archivedAt: latestRegistration.archivedAt,
            archiveType: hasAgeOutNotice ? "AGED_OUT" : "ADMIN_ARCHIVED",
            reason: latestRegistration.archivedReason,
          }
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
            placeOfBirth: kkProfile?.placeOfBirth ?? null,
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
