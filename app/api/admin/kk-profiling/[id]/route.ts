import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function authorizeUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const appUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { role: true },
  });

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
    } = payload;

    if (!fullName?.trim() || !address?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Name, address, and email are required." },
        { status: 400 }
      );
    }

    const registration = await prisma.profilingRegistration.findUnique({
      where: { id },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    const updated = await prisma.profilingRegistration.update({
      where: { id },
      data: {
        fullName: fullName.trim(),
        address: address.trim(),
        sex: sex?.trim() ?? registration.sex,
        age: Number(age ?? registration.age),
        birthDate: birthDate ? new Date(birthDate) : registration.birthDate,
        email: email.trim(),
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
        consent: typeof consent === "boolean" ? consent : registration.consent,
      },
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await prisma.user.findUnique({
      where: { authId: user.id },
      select: { role: true },
    });

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SK officials can delete profiling registrations" },
        { status: 403 }
      );
    }

    const registration = await prisma.profilingRegistration.findUnique({
      where: { id },
    });

    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    await prisma.profilingRegistration.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to delete profiling registration:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to delete profiling registration", details: errorMessage },
      { status: 500 }
    );
  }
}
