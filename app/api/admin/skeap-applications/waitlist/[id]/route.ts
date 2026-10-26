import { Role, SubmissionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeAdmin();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Application id is required." }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.skeapApplication.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          waitlistPosition: true,
          applicantName: true,
          userId: true,
          inquiry: { select: { id: true } },
        },
      });
      if (!application) throw new Error("NOT_FOUND");
      if (application.status !== SubmissionStatus.WAITLISTED) throw new Error("NOT_WAITLISTED");

      await tx.skeapApplication.update({
        where: { id },
        data: { status: SubmissionStatus.PENDING, waitlistPosition: null },
      });
      if (application.inquiry) {
        await tx.inquiry.update({
          where: { id: application.inquiry.id },
          data: {
            reviewStatus: "Pending",
            response: "This application was removed from the SKEAP waitlist by an administrator and returned to pending review.",
            respondedAt: null,
            isResolved: false,
            lastUpdatedBy: "admin",
          },
        });
      }

      const remaining = await tx.skeapApplication.findMany({
        where: { status: SubmissionStatus.WAITLISTED },
        orderBy: [{ waitlistPosition: "asc" }, { submittedAt: "asc" }],
        select: { id: true, waitlistPosition: true },
      });
      for (const [index, item] of remaining.entries()) {
        if (item.waitlistPosition !== index + 1) {
          await tx.skeapApplication.update({
            where: { id: item.id },
            data: { waitlistPosition: index + 1 },
          });
        }
      }

      await writeAuditLog(tx, {
        action: "APPLICATION_REMOVED_FROM_WAITLIST",
        actorId: auth.user.id,
        targetTable: "skeap_applications",
        targetId: application.id,
        beforeData: {
          status: application.status,
          waitlistPosition: application.waitlistPosition,
        },
        afterData: { status: SubmissionStatus.PENDING, waitlistPosition: null },
        metadata: { target: application.applicantName || application.userId },
      });

      return { id: application.id, applicantName: application.applicantName || "Applicant" };
    });

    return NextResponse.json({ success: true, application: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove applicant from the waitlist.";
    if (message === "NOT_FOUND") return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (message === "NOT_WAITLISTED") return NextResponse.json({ error: "Application is not currently waitlisted." }, { status: 409 });
    console.error("Failed to remove SKEAP application from waitlist:", error);
    return NextResponse.json({ error: "Unable to remove applicant from the waitlist." }, { status: 500 });
  }
}
