import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidContactNumber, isValidNameInput } from "@/lib/kk-profiling-inputs";
import { formatSexLabel, parseSex } from "@/lib/sex";
import { syncKkProfileFromLatestRegistration } from "@/lib/kk-profile-sync";

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
  if (registration.reviewStatus?.trim().toLowerCase() === "rejected") {
    return NextResponse.json(
      { error: "This registration was rejected and can no longer be edited or resubmitted. Contact Barangay Pico staff if you need clarification." },
      { status: 409 }
    );
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

  if (fullName !== undefined && !isValidNameInput(String(fullName))) {
    return NextResponse.json({ error: "Name must contain at least two letters and no numbers." }, { status: 400 });
  }
  if (contactNumber !== undefined && !isValidContactNumber(String(contactNumber))) {
    return NextResponse.json({ error: "Contact number can contain numbers only." }, { status: 400 });
  }
  const parsedSex = sex === undefined ? null : parseSex(sex);
  if (sex !== undefined && !parsedSex) {
    return NextResponse.json({ error: "Sex must be Male, Female, or Not specified." }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.profilingRegistration.update({
      where: { id: registration.id },
      data: {
        fullName: fullName?.trim() ?? registration.fullName,
        address: address?.trim() ?? registration.address,
        sex: parsedSex ? formatSexLabel(parsedSex) : registration.sex,
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

    if (registration.userId) {
      await syncKkProfileFromLatestRegistration(tx, registration.userId);
    }

    return saved;
  });

  return NextResponse.json(updated);
}
