import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { databaseUnavailableResponse } from "@/lib/database-errors";
import { writeAuditLog } from "@/lib/audit/logger";
import {
  refreshKkProfilingApplicationsAdminView,
} from "@/lib/application-admin-view-refresh";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const activeReviewStatuses = new Set([
  "pending",
  "pending verification",
  "resubmitted",
  "returned",
]);

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    const registration = await prisma.profilingRegistration.findFirst({
      where: { userId: appUser.id },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      select: { reviewStatus: true },
    });
    const reviewStatus = registration?.reviewStatus?.trim() || null;
    const isApproved = reviewStatus?.toLowerCase() === "approved";
    const kkProfile = isApproved
      ? await prisma.user.findUnique({
          where: { id: appUser.id },
          select: { kkProfile: { select: { isVerified: true } } },
        })
      : null;

    return NextResponse.json({
      hasPendingApplication:
        Boolean(reviewStatus && activeReviewStatuses.has(reviewStatus.toLowerCase())),
      reviewStatus,
      isProfileVerified: kkProfile?.kkProfile?.isVerified === true,
    });
  } catch (error) {
    const unavailable = databaseUnavailableResponse(error, "GET /api/my/kk-profiling-application");
    if (unavailable) return unavailable;
    throw error;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const appUser = await ensureProfile(user);
  if (!appUser) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  const withdrawalReason =
    typeof body === "object" && body !== null && "withdrawalReason" in body &&
    typeof body.withdrawalReason === "string"
      ? body.withdrawalReason.trim()
      : "";
  if (withdrawalReason.length > 500) {
    return NextResponse.json({ error: "Withdrawal reason must be 500 characters or fewer." }, { status: 400 });
  }

  const registration = await prisma.profilingRegistration.findFirst({
    where: { userId: appUser.id },
    orderBy: { submittedAt: "desc" },
    select: { id: true, reviewStatus: true },
  });
  if (!registration) {
    return NextResponse.json({ error: "KK profiling registration not found." }, { status: 404 });
  }

  const normalizedStatus = registration.reviewStatus.trim().toLowerCase();
  if (!activeReviewStatuses.has(normalizedStatus)) {
    return NextResponse.json(
      { error: "Only pending, returned, or resubmitted KK Profiling applications can be withdrawn." },
      { status: 409 },
    );
  }

  const withdrawnAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.profilingRegistration.updateMany({
      where: {
        id: registration.id,
        userId: appUser.id,
        reviewStatus: registration.reviewStatus,
      },
      data: {
        reviewStatus: "Withdrawn",
        withdrawnAt,
        withdrawalReason: withdrawalReason || null,
      },
    });
    if (result.count !== 1) return false;

    await writeAuditLog(tx, {
      action: "KK_PROFILING_APPLICATION_WITHDRAWN",
      actorId: appUser.id,
      targetTable: "kk_profiling_registrations",
      targetId: registration.id,
      beforeData: { reviewStatus: registration.reviewStatus },
      afterData: {
        reviewStatus: "Withdrawn",
        withdrawnAt: withdrawnAt.toISOString(),
        withdrawalReason: withdrawalReason || null,
      },
      metadata: { target: appUser.fullName, targetEmail: appUser.email },
    });
    return true;
  });

  if (!updated) {
    return NextResponse.json(
      { error: "The application status changed. Refresh and try again." },
      { status: 409 },
    );
  }

  await refreshKkProfilingApplicationsAdminView();
  revalidatePath("/admin/kk-profiling");
  revalidatePath("/programs/kk-profiling/status");
  return NextResponse.json({
    success: true,
    status: "Withdrawn",
    withdrawnAt: withdrawnAt.toISOString(),
    withdrawalReason: withdrawalReason || null,
  });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const appUser = await ensureProfile(user);
  if (!appUser) return NextResponse.json({ error: "User profile not found" }, { status: 404 });

  const registration = await prisma.profilingRegistration.findFirst({
    where: { userId: appUser.id },
    orderBy: { submittedAt: "desc" },
    select: { id: true, reviewStatus: true },
  });
  if (!registration) {
    return NextResponse.json({ error: "KK profiling draft not found." }, { status: 404 });
  }
  if (registration.reviewStatus.trim().toLowerCase() !== "draft") {
    return NextResponse.json(
      { error: "Submitted KK Profiling applications cannot be deleted. Withdraw an eligible application instead." },
      { status: 403 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.profilingRegistration.delete({
      where: { id: registration.id, userId: appUser.id },
    });
    await writeAuditLog(tx, {
      action: "KK_PROFILING_DRAFT_DELETED",
      actorId: appUser.id,
      targetTable: "kk_profiling_registrations",
      targetId: registration.id,
      beforeData: { reviewStatus: "Draft" },
      metadata: { target: appUser.fullName, targetEmail: appUser.email },
    });
  });

  await refreshKkProfilingApplicationsAdminView();
  revalidatePath("/admin/kk-profiling");
  revalidatePath("/programs/kk-profiling/status");
  return NextResponse.json({ success: true });
}
