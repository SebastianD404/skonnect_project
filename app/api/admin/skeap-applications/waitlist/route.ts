import { Role, SubmissionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/logger";
import { getSkeapWaitlistSnapshot } from "@/lib/skeap-waitlist";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";

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

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeAdmin();
    if ("error" in auth) return auth.error;

    if (request.nextUrl.searchParams.get("mode") === "candidates") {
      const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
      if (query.length < 2) {
        return NextResponse.json({ applications: [] });
      }

      const candidates = await prisma.skeapApplication.findMany({
        where: {
          status: SubmissionStatus.PENDING,
          OR: [
            { applicantName: { contains: query, mode: "insensitive" } },
            { emailAddress: { contains: query, mode: "insensitive" } },
            { user: { fullName: { contains: query, mode: "insensitive" } } },
            { user: { email: { contains: query, mode: "insensitive" } } },
          ],
        },
        orderBy: { submittedAt: "asc" },
        take: 20,
        select: {
          id: true,
          submittedAt: true,
          applicantName: true,
          emailAddress: true,
          contactNumber: true,
          school: true,
          educationLevel: true,
          currentCourse: true,
          yearLevel: true,
          user: { select: { fullName: true, email: true } },
        },
      });

      return NextResponse.json({
        applications: candidates.map((application) => ({
          id: application.id,
          waitlistPosition: null,
          submittedAt: application.submittedAt.toISOString(),
          applicantName: application.applicantName || application.user.fullName || application.user.email,
          emailAddress: application.emailAddress || application.user.email,
          contactNumber: application.contactNumber,
          school: normalizeSkeapSchoolName(application.school),
          educationLevel: application.educationLevel,
          currentCourse: application.currentCourse,
          yearLevel: application.yearLevel,
        })),
      });
    }

    return NextResponse.json(await getSkeapWaitlistSnapshot());
  } catch (error) {
    console.error("Failed to load SKEAP waitlist:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load SKEAP waitlist." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeAdmin();
    if ("error" in auth) return auth.error;

    const body: unknown = await request.json().catch(() => null);
    const applicationId = body && typeof body === "object" && "applicationId" in body
      ? body.applicationId
      : null;
    if (typeof applicationId !== "string" || !applicationId.trim()) {
      return NextResponse.json({ error: "Choose an application to add to the waitlist." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.skeapApplication.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          status: true,
          applicantName: true,
          userId: true,
          inquiry: { select: { id: true } },
        },
      });
      if (!application) throw new Error("NOT_FOUND");
      if (application.status !== SubmissionStatus.PENDING) throw new Error("NOT_PENDING");

      const position = (await tx.skeapApplication.count({
        where: { status: SubmissionStatus.WAITLISTED },
      })) + 1;
      await tx.skeapApplication.update({
        where: { id: application.id },
        data: { status: SubmissionStatus.WAITLISTED, waitlistPosition: position },
      });

      if (application.inquiry) {
        await tx.inquiry.update({
          where: { id: application.inquiry.id },
          data: {
            reviewStatus: "Waitlisted",
            response: "Your SKEAP application was manually approved and added to the scholarship waitlist by an administrator.",
            respondedAt: new Date(),
            isResolved: true,
            lastUpdatedBy: "admin",
          },
        });
      }

      await writeAuditLog(tx, {
        action: "APPLICATION_ADDED_TO_WAITLIST",
        actorId: auth.user.id,
        targetTable: "skeap_applications",
        targetId: application.id,
        beforeData: { status: application.status },
        afterData: { status: SubmissionStatus.WAITLISTED, waitlistPosition: position },
        metadata: { target: application.applicantName || application.userId },
      });

      return {
        id: application.id,
        applicantName: application.applicantName || "Applicant",
        waitlistPosition: position,
      };
    });

    return NextResponse.json({ success: true, application: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add application to the waitlist.";
    if (message === "NOT_FOUND") return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (message === "NOT_PENDING") return NextResponse.json({ error: "Only pending applications can be manually added to the waitlist." }, { status: 409 });
    console.error("Failed to manually add SKEAP application to waitlist:", error);
    return NextResponse.json({ error: "Unable to add application to the waitlist." }, { status: 500 });
  }
}