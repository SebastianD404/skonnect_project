import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const payload = await request.json();
  const registration = await prisma.profilingRegistration.findFirst({
    where: { userId: appUser.id },
    orderBy: { submittedAt: "desc" },
  });

  if (!registration) {
    return NextResponse.json({ error: "KK profiling registration not found." }, { status: 404 });
  }

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
  } = payload;

  const updated = await prisma.profilingRegistration.update({
    where: { id: registration.id },
    data: {
      fullName: fullName?.trim() ?? registration.fullName,
      address: address?.trim() ?? registration.address,
      sex: sex?.trim() ?? registration.sex,
      age: age !== undefined ? Number(age) : registration.age,
      birthDate: birthDate ? new Date(birthDate) : registration.birthDate,
      email: email?.trim() ?? registration.email,
      facebook: facebook?.trim() ?? registration.facebook,
      contactNumber: contactNumber?.trim() ?? registration.contactNumber,
      civilStatus: civilStatus?.trim() ?? registration.civilStatus,
      youthClassification: youthClassification?.trim() ?? registration.youthClassification,
      youthAgeGroup: youthAgeGroup?.trim() ?? registration.youthAgeGroup,
      workStatus: workStatus?.trim() ?? registration.workStatus,
      educationalBackground: educationalBackground?.trim() ?? registration.educationalBackground,
      registeredSKVoter: registeredSKVoter?.trim() ?? registration.registeredSKVoter,
      votedLastSK: votedLastSK?.trim() ?? registration.votedLastSK,
      registeredNationalVoter: registeredNationalVoter?.trim() ?? registration.registeredNationalVoter,
      attendedKKAssembly: attendedKKAssembly?.trim() ?? registration.attendedKKAssembly,
      assemblyTimes: assemblyTimes?.trim() ?? registration.assemblyTimes,
      noAssemblyReason: noAssemblyReason?.trim() ?? registration.noAssemblyReason,
    },
  });

  return NextResponse.json(updated);
}
