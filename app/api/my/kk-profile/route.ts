import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  const profile = await prisma.user.findUnique({
    where: { id: appUser.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      kkProfile: {
        select: {
          id: true,
          fullName: true,
          purok: true,
          addressLine: true,
          barangay: true,
          birthDate: true,
          contactNumber: true,
          email: true,
          isVerified: true,
        },
      },
    },
  });

  if (!profile?.kkProfile) {
    return NextResponse.json({ error: "KK profile not found" }, { status: 404 });
  }

  const latestRegistration = await prisma.profilingRegistration.findFirst({
    where: { userId: appUser.id },
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
      submittedAt: true,
      idDocumentType: true,
      idFrontFileUrl: true,
      idBackFileUrl: true,
      idSingleFileUrl: true,
    },
  });

  const status = latestRegistration?.reviewStatus || (profile.kkProfile.isVerified ? "Approved" : "Pending verification");

  return NextResponse.json({
    profile: {
      id: profile.kkProfile.id,
      fullName: profile.kkProfile.fullName,
      email: profile.kkProfile.email || profile.email,
      contactNumber: profile.kkProfile.contactNumber || profile.phoneNumber,
      purok: profile.kkProfile.purok,
      addressLine: profile.kkProfile.addressLine,
      barangay: profile.kkProfile.barangay,
      birthDate: profile.kkProfile.birthDate,
      age: computeAge(profile.kkProfile.birthDate),
      isVerified: profile.kkProfile.isVerified,
      status,
      reviewNotes: latestRegistration?.reviewNotes ?? null,
      registrationSubmittedAt: latestRegistration?.submittedAt ?? null,
      idDocumentType: latestRegistration?.idDocumentType ?? null,
      idFrontFileUrl: latestRegistration?.idFrontFileUrl ?? null,
      idBackFileUrl: latestRegistration?.idBackFileUrl ?? null,
      idSingleFileUrl: latestRegistration?.idSingleFileUrl ?? null,
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
            submittedAt: latestRegistration.submittedAt,
            idDocumentType: latestRegistration.idDocumentType,
            idFrontFileUrl: latestRegistration.idFrontFileUrl,
            idBackFileUrl: latestRegistration.idBackFileUrl,
            idSingleFileUrl: latestRegistration.idSingleFileUrl,
          }
        : null,
    },
  });
}
