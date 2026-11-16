import { after, NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { lockSkeapCapacity } from "@/lib/skeap-capacity";
import { reindexSkeapWaitlist } from "@/lib/skeap-waitlist";
import { getSkeapWaitlistCycleState } from "@/lib/skeap-waitlist-cycle";
import { getCurrentAcademicYear } from "@/lib/semester";
import { refreshSkeapApplicationsAdminView } from "@/lib/application-admin-view-refresh";

const WITHDRAWABLE_STATUSES = new Set([
  "PENDING",
  "UNDER_REVIEW",
  "PRE_QUALIFIED",
  "RETURNED",
  "RETURNED_FOR_EDIT",
  "WAITLISTED",
]);

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const body = await request.json().catch(() => null);
    let applicationId: string | undefined = params?.id;
    if (!applicationId) {
      applicationId = request.nextUrl.searchParams.get("id") || undefined;
    }

    if (!applicationId) {
      if (body && typeof body.id === "string") applicationId = body.id;
    }

    if (!applicationId) {
      return NextResponse.json({ error: "Missing application id." }, { status: 400 });
    }

    if (body?.action !== "WITHDRAW") {
      return NextResponse.json({ error: "A WITHDRAW action is required." }, { status: 400 });
    }
    const withdrawalReason =
      typeof body.withdrawalReason === "string" ? body.withdrawalReason.trim() : null;
    if (withdrawalReason && withdrawalReason.length > 500) {
      return NextResponse.json({ error: "Withdrawal reason must be 500 characters or fewer." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "User not found." }, { status: 401 });
    }
    if (appUser.role !== Role.YOUTH) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        userId: true,
        application: {
          select: {
            id: true,
            userId: true,
            status: true,
            submittedAt: true,
            waitlistPosition: true,
          },
        },
      },
    });
    if (!inquiry) throw new Error("APPLICATION_NOT_FOUND");
    if (inquiry.userId !== appUser.id) throw new Error("FORBIDDEN");
    const skeapApplication = inquiry.application;
    if (!skeapApplication) throw new Error("SKEAP_APPLICATION_NOT_FOUND");
    if (skeapApplication.userId !== appUser.id) throw new Error("FORBIDDEN");

    const previousStatus = skeapApplication.status;
    if (!WITHDRAWABLE_STATUSES.has(previousStatus)) {
      throw new Error("APPLICATION_NOT_WITHDRAWABLE");
    }

    const withdrawnAt = new Date();
    await prisma.$transaction(async (tx) => {
      const update = await tx.skeapApplication.updateMany({
        where: {
          id: skeapApplication.id,
          userId: appUser.id,
          status: previousStatus,
        },
        data: {
          status: "WITHDRAWN",
          waitlistPosition: null,
          waitlistFinalPosition: null,
          withdrawnAt,
          withdrawalReason,
        },
      });
      if (update.count !== 1) throw new Error("APPLICATION_STATUS_CHANGED");

      await tx.inquiry.update({
        where: { id: inquiry.id },
        data: {
          isResolved: true,
          response: "Withdrawn by applicant",
          respondedAt: withdrawnAt,
          reviewStatus: "Withdrawn",
          lastUpdatedBy: "applicant",
        },
      });

      await writeAuditLog(tx, {
        action: "SKEAP_APPLICATION_WITHDRAWN",
        actorId: appUser.id,
        targetTable: "skeap_applications",
        targetId: skeapApplication.id,
        beforeData: {
          status: previousStatus,
          waitlistPosition: skeapApplication.waitlistPosition,
        },
        afterData: {
          status: "WITHDRAWN",
          withdrawnAt: withdrawnAt.toISOString(),
          withdrawalReason,
        },
        metadata: { inquiryId: inquiry.id },
      });
    });

    try {
      revalidatePath("/applications");
      revalidatePath(`/applications/${applicationId}`);
      revalidatePath("/dashboard");
      revalidatePath("/admin/skeap-applications");
      revalidatePath("/admin/skeap-waitlist");
      revalidatePath("/admin");
    } catch (revalidationError) {
      console.warn("Application withdrawal succeeded but page revalidation failed.", revalidationError);
    }

    after(async () => {
      try {
        await refreshSkeapApplicationsAdminView();
      } catch (refreshError) {
        console.error("Failed to refresh SKEAP admin application view after withdrawal.", refreshError);
      }

      if (previousStatus === "WAITLISTED") {
        try {
          const cycle = getCurrentAcademicYear(skeapApplication.submittedAt);
          await prisma.$transaction(async (tx) => {
            await lockSkeapCapacity(tx);
            const cycleState = await getSkeapWaitlistCycleState(cycle, tx);
            if (!cycleState.isClosed) await reindexSkeapWaitlist(tx, cycle);
          });
        } catch (reindexError) {
          console.error("Failed to reindex SKEAP waitlist after withdrawal.", reindexError);
        }
      }
    });

    return NextResponse.json({ success: true, status: "WITHDRAWN" });
  } catch (err) {
    console.error("[POST /api/applications/[id]/cancel]", err);
    const message = err instanceof Error ? err.message : "Unable to withdraw application.";
    if (message === "APPLICATION_NOT_FOUND") {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (message === "SKEAP_APPLICATION_NOT_FOUND") {
      return NextResponse.json({ error: "This record is not a SKEAP application." }, { status: 400 });
    }
    if (message === "APPLICATION_NOT_WITHDRAWABLE") {
      return NextResponse.json(
        { error: "This application can no longer be withdrawn because its review is finalized." },
        { status: 403 },
      );
    }
    if (message === "APPLICATION_STATUS_CHANGED") {
      return NextResponse.json(
        { error: "The application status changed. Refresh the page and try again." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Unable to withdraw application. Please try again." }, { status: 500 });
  }
}
