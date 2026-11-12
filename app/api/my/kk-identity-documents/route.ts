import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Could not verify session for KK identity documents:", error);
    return NextResponse.json({ error: "Unable to verify your session." }, { status: 500 });
  }
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const appUser = await ensureProfile(authUser);
  if (!appUser) {
    return NextResponse.json({ error: "Account profile not found." }, { status: 404 });
  }
  if (appUser.kkStatus !== "APPROVED") {
    return NextResponse.json({ error: "Approved KK Profiling is required." }, { status: 403 });
  }

  const registration = await prisma.profilingRegistration.findFirst({
    where: {
      userId: appUser.id,
      reviewStatus: { equals: "Approved", mode: "insensitive" },
    },
    orderBy: { submittedAt: "desc" },
    select: {
      photoFileUrl: true,
      birthCertificateFileUrl: true,
      idFrontFileUrl: true,
      idBackFileUrl: true,
      idSingleFileUrl: true,
    },
  });

  if (!registration) {
    return NextResponse.json({ error: "No approved KK Profiling documents were found." }, { status: 404 });
  }

  const documents = {
    photo: registration.photoFileUrl,
    birthCertificate: registration.birthCertificateFileUrl,
    validIdFront: registration.idFrontFileUrl,
    validIdBack: registration.idBackFileUrl,
    residency: registration.idSingleFileUrl,
  };
  if (Object.values(documents).some((url) => !url)) {
    return NextResponse.json(
      { error: "Your approved KK Profile is missing one or more identity documents. Contact SK support." },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { documents },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
