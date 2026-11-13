import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit/logger";
import { createGmailTransporter, sendBroadcastEmail } from "@/lib/broadcast-email";
import { GRANTEE_PLACEHOLDER_SCHOOL, GRANTEE_PLACEHOLDER_YEAR_LEVEL } from "@/lib/grantee-profile";
import { DEFAULT_SKEAP_MAX_SLOTS, getSkeapCapacityCount, getSkeapMaxSlots, lockSkeapCapacity } from "@/lib/skeap-capacity";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { refreshInactiveGranteesView } from "@/lib/grantee-archive-view";
import { reindexSkeapWaitlist } from "@/lib/skeap-waitlist";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Application id is required." }, { status: 400 });

  let confirmPhysicalVerification = false;
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "A valid promotion confirmation is required." }, { status: 400 });
    }
    confirmPhysicalVerification =
      (body as Record<string, unknown>).confirmPhysicalVerification === true;
  } catch {
    return NextResponse.json({ error: "A valid promotion confirmation is required." }, { status: 400 });
  }

  let maxSlots = DEFAULT_SKEAP_MAX_SLOTS;
  try {
    const promoted = await prisma.$transaction(async (tx) => {
      await lockSkeapCapacity(tx);
      maxSlots = await getSkeapMaxSlots(tx);
      const application = await tx.skeapApplication.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          physicalDocumentsConfirmed: true,
          userId: true,
          applicantName: true,
          user: { select: { email: true } },
          school: true,
          currentCourse: true,
          yearLevel: true,
          inquiry: { select: { id: true } },
        },
      });
      if (!application) throw new Error("NOT_FOUND");
      if (application.status !== "WAITLISTED") throw new Error("NOT_WAITLISTED");
      if (!application.physicalDocumentsConfirmed && !confirmPhysicalVerification) {
        throw new Error("PHYSICAL_VERIFICATION_REQUIRED");
      }

      const existingGrantee = await tx.grantee.findUnique({
        where: { userId: application.userId },
        select: { status: true },
      });
      if (existingGrantee?.status === "GRADUATED") throw new Error("GRANTEE_ARCHIVED");

      const activeCount = await getSkeapCapacityCount(tx, application.userId);
      if (activeCount >= maxSlots) throw new Error("CAPACITY_FULL");

      await tx.skeapApplication.update({
        where: { id },
        data: {
          status: "APPROVED",
          waitlistPosition: null,
          physicalDocumentsConfirmed: true,
        },
      });

      if (application.inquiry) {
        await tx.inquiry.update({
          where: { id: application.inquiry.id },
          data: {
            reviewStatus: "Approved",
            response: "Your SKEAP application has been promoted from the waitlist and approved.",
            respondedAt: new Date(),
            isResolved: true,
            lastUpdatedBy: "admin",
          },
        });
      }

      await tx.user.update({ where: { id: application.userId }, data: { role: Role.GRANTEE } });
      await tx.grantee.upsert({
        where: { userId: application.userId },
        create: {
          userId: application.userId,
          school: normalizeSkeapSchoolName(application.school || application.currentCourse || GRANTEE_PLACEHOLDER_SCHOOL),
          yearLevel: application.yearLevel || GRANTEE_PLACEHOLDER_YEAR_LEVEL,
          status: "ACTIVE",
          dateEnrolled: new Date(),
        },
        update: {
          school: normalizeSkeapSchoolName(application.school || application.currentCourse || GRANTEE_PLACEHOLDER_SCHOOL),
          yearLevel: application.yearLevel || GRANTEE_PLACEHOLDER_YEAR_LEVEL,
          status: "ACTIVE",
          dateRemoved: null,
        },
      });

      await reindexSkeapWaitlist(tx);

      return {
        id: application.id,
        applicantId: application.userId,
        applicantName: application.applicantName,
        applicantEmail: application.user.email,
        granteeStatusChanged:
          existingGrantee?.status === "REMOVED" || existingGrantee?.status === "REVOKED",
      };
    });

    const { granteeStatusChanged, applicantEmail, ...promotedApplication } = promoted;
    if (granteeStatusChanged) {
      try {
        await refreshInactiveGranteesView();
      } catch (error) {
        console.error("SKEAP promotion completed, but the grantee archive view could not be refreshed:", error);
        return NextResponse.json(
          { error: "SKEAP promotion completed, but the grantee archive report could not be refreshed." },
          { status: 503 }
        );
      }
    }

    let emailSent = false;
    try {
      const transporter = createGmailTransporter();
      const emailResult = await sendBroadcastEmail(
        transporter,
        promotedApplication.applicantId,
        applicantEmail,
        "Your SKEAP scholarship application was approved",
        `Hello ${promotedApplication.applicantName || "Scholar"},\n\nYour SKEAP scholarship application has been promoted from the waitlist and approved. Your account is now active as a Grantee.\n\nPlease sign in to SKonnect to view your scholarship information.\n\nSKEAP Administration`,
      );
      emailSent = emailResult !== null;
    } catch (error) {
      console.error("SKEAP promotion completed, but the approval email could not be sent:", error);
    }

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      action: "APPLICATION_PROMOTED",
      resource: "skeap_applications",
      resourceId: promotedApplication.id,
      metadata: {
        applicantId: promotedApplication.applicantId,
        target: promotedApplication.applicantName || promotedApplication.applicantId,
        resultingStatus: "APPROVED",
        physicalDocumentsConfirmed: true,
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/skeap-applications");
    revalidatePath("/admin/skeap-waitlist");
    revalidatePath("/applications");
    revalidatePath("/youth-dashboard");
    revalidatePath("/grantee-dashboard");
    revalidatePath("/admin/grantees");
    revalidatePath("/admin/members");
    revalidatePath("/admin/kk-profiling");

    return NextResponse.json({ success: true, emailSent, application: promotedApplication });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to promote application.";
    if (message === "NOT_FOUND") return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (message === "NOT_WAITLISTED") return NextResponse.json({ error: "Application is not currently waitlisted." }, { status: 409 });
    if (message === "PHYSICAL_VERIFICATION_REQUIRED") {
      return NextResponse.json({ error: "Confirm that the original/CTC documents were physically verified before promotion." }, { status: 400 });
    }
    if (message === "GRANTEE_ARCHIVED") return NextResponse.json({ error: "Graduated Grantee records cannot be changed by SKEAP promotion." }, { status: 409 });
    if (message === "CAPACITY_FULL") {
      return NextResponse.json(
        { error: `All ${maxSlots} SKEAP slots are currently filled. The applicant remains WAITLISTED.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}