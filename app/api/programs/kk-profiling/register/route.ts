import { NextResponse } from "next/server";
import { prisma, createProfilingRegistration } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !body.consent) {
      return NextResponse.json({ error: "Consent is required" }, { status: 400 });
    }

    const age = Number(body.age);
    const birthDate = body.birthDate ? new Date(body.birthDate) : null;

    if (!body.fullName?.trim()) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }
    if (!body.address?.trim()) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }
    if (!body.email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!body.contactNumber?.trim()) {
      return NextResponse.json({ error: "Contact number is required" }, { status: 400 });
    }
    if (!body.youthClassification?.trim()) {
      return NextResponse.json({ error: "Youth classification is required" }, { status: 400 });
    }
    if (!body.youthAgeGroup?.trim()) {
      return NextResponse.json({ error: "Youth age group is required" }, { status: 400 });
    }
    if (Number.isNaN(age) || age <= 0) {
      return NextResponse.json({ error: "Valid age is required" }, { status: 400 });
    }
    if (!birthDate || Number.isNaN(birthDate.getTime())) {
      return NextResponse.json({ error: "Valid birth date is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userId: string | undefined;
    if (user) {
      const appUser = await prisma.user.findUnique({
        where: { authId: user.id },
        select: { id: true },
      });
      if (appUser) {
        userId = appUser.id;
      }
    }

    const registration = await createProfilingRegistration({
      data: {
        userId,
        fullName: body.fullName.trim(),
        address: body.address.trim(),
        sex: body.sex?.trim() ?? "",
        age,
        birthDate,
        email: body.email.trim(),
        facebook: body.facebook?.trim() ?? "",
        contactNumber: body.contactNumber.trim(),
        civilStatus: body.civilStatus?.trim() ?? "",
        youthClassification: body.youthClassification.trim(),
        youthAgeGroup: body.youthAgeGroup.trim(),
        workStatus: body.workStatus?.trim() ?? "",
        educationalBackground: body.educationalBackground?.trim() ?? "",
        registeredSKVoter: body.registeredSKVoter?.trim() ?? "",
        votedLastSK: body.votedLastSK?.trim() ?? "",
        registeredNationalVoter: body.registeredNationalVoter?.trim() ?? "",
        attendedKKAssembly: body.attendedKKAssembly?.trim() ?? "",
        assemblyTimes: body.assemblyTimes?.trim() ?? null,
        noAssemblyReason: body.noAssemblyReason?.trim() ?? null,
        consent: true,
      },
    });

    return NextResponse.json({ success: true, registrationId: registration.id });
  } catch (err) {
    if (err instanceof Error && err.message.includes("currently unavailable")) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }

    console.error(err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
