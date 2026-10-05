import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { createClient } from "@/lib/supabase/server";
import { mapInquiryToApplication, SKEAP_APPLICATION_SELECT } from "@/lib/skeap-applications";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const appUser = await ensureProfile(user);
    if (appUser?.role !== Role.SK_OFFICIAL && appUser?.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const inquiry = await prisma.inquiry.findFirst({
      where: {
        id,
        subject: { contains: "SKEAP application", mode: "insensitive" },
      },
      select: SKEAP_APPLICATION_SELECT,
    });
    if (!inquiry) return NextResponse.json({ error: "Application not found." }, { status: 404 });

    const application = mapInquiryToApplication(inquiry);
    return NextResponse.json({
      profile: {
        applicantName: application.applicantName,
        applicantEmail: application.applicantEmail,
        applicantPhoneNumber: application.applicantPhoneNumber,
        school: normalizeSkeapSchoolName(application.school),
        yearLevel: application.yearLevel,
      },
    });
  } catch (error) {
    console.error("Failed to refresh SKEAP applicant profile:", error);
    return NextResponse.json({ error: "Failed to refresh applicant profile." }, { status: 500 });
  }
}
