import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSkeapMaxSlots } from "@/lib/skeap-capacity";

async function authorizeAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user: appUser };
}

export async function GET() {
  try {
    const auth = await authorizeAdmin();
    if ("error" in auth) return auth.error;

  const applications = await prisma.skeapApplication.findMany({
    where: { status: "WAITLISTED" },
    orderBy: [{ waitlistPosition: "asc" }, { submittedAt: "asc" }],
    select: {
      id: true,
      waitlistPosition: true,
      submittedAt: true,
      applicantName: true,
      emailAddress: true,
      contactNumber: true,
      school: true,
      currentCourse: true,
      yearLevel: true,
      user: { select: { fullName: true, email: true } },
    },
  });
    const [activeCount, maxSlots] = await Promise.all([
      prisma.skeapApplication.count({ where: { status: "APPROVED" } }),
      getSkeapMaxSlots(),
    ]);

    return NextResponse.json({
      activeCount,
      maxSlots,
      applications: applications.map((application) => ({
        ...application,
        applicantName: application.applicantName || application.user.fullName || application.user.email,
        emailAddress: application.emailAddress || application.user.email,
        submittedAt: application.submittedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to load SKEAP waitlist:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load SKEAP waitlist." },
      { status: 500 }
    );
  }
}