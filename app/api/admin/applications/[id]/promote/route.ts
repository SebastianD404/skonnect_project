import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit/logger";
import { GRANTEE_PLACEHOLDER_SCHOOL, GRANTEE_PLACEHOLDER_YEAR_LEVEL } from "@/lib/grantee-profile";
import { ACTIVE_SKEAP_APPLICATION_WHERE, DEFAULT_SKEAP_MAX_SLOTS, getSkeapMaxSlots } from "@/lib/skeap-capacity";
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Application id is required." }, { status: 400 });

  let maxSlots = DEFAULT_SKEAP_MAX_SLOTS;
  try {
    maxSlots = await getSkeapMaxSlots();
    const promoted = await prisma.$transaction(async (tx) => {
      const application = await tx.skeapApplication.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          userId: true,
          applicantName: true,
          school: true,
          currentCourse: true,
          yearLevel: true,
          inquiry: { select: { id: true } },
        },
      });

      if (!application) throw new Error("NOT_FOUND");
      if (application.status !== "WAITLISTED") throw new Error("NOT_WAITLISTED");

      const existingGrantee = await tx.grantee.findUnique({
        where: { userId: application.userId },
        select: { status: true },
      });
      if (existingGrantee?.status === "GRADUATED") throw new Error("GRANTEE_ARCHIVED");

      const activeCount = await tx.skeapApplication.count({ where: ACTIVE_SKEAP_APPLICATION_WHERE });
      if (activeCount >= maxSlots) throw new Error("CAPACITY_FULL");

      await tx.skeapApplication.update({
        where: { id },
        data: { status: "APPROVED", waitlistPosition: null },
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
        },
        update: {
          school: normalizeSkeapSchoolName(application.school || application.currentCourse || GRANTEE_PLACEHOLDER_SCHOOL),
          yearLevel: application.yearLevel || GRANTEE_PLACEHOLDER_YEAR_LEVEL,
          status: "ACTIVE",
          dateRemoved: null,
        },
      });

      const remaining = await tx.skeapApplication.findMany({
        where: { status: "WAITLISTED" },
        orderBy: [{ waitlistPosition: "asc" }, { submittedAt: "asc" }],
        select: { id: true, waitlistPosition: true },
      });

      // Re-index the queue contiguously after promotion.
      for (const [index, item] of remaining.entries()) {
        if (item.waitlistPosition !== index + 1) {
          await tx.skeapApplication.update({
            where: { id: item.id },
            data: { waitlistPosition: index + 1 },
          });
        }
      }

      return {
        id: application.id,
        applicantId: application.userId,
        applicantName: application.applicantName,
      };
    });

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      action: "APPLICATION_PROMOTED",
      resource: "skeap_applications",
      resourceId: promoted.id,
      metadata: {
        applicantId: promoted.applicantId,
        target: promoted.applicantName || promoted.applicantId,
        resultingStatus: "APPROVED",
      },
    });

    return NextResponse.json({ success: true, application: promoted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to promote application.";
    if (message === "NOT_FOUND") return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (message === "NOT_WAITLISTED") return NextResponse.json({ error: "Application is not currently waitlisted." }, { status: 409 });
    if (message === "GRANTEE_ARCHIVED") return NextResponse.json({ error: "Graduated Grantee records cannot be changed by SKEAP promotion." }, { status: 409 });
    if (message === "CAPACITY_FULL") return NextResponse.json({ error: `All ${maxSlots} SKEAP slots are currently filled.` }, { status: 409 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}