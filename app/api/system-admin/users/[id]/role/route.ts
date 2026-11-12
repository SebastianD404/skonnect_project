import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { refreshInactiveGranteesView } from "@/lib/grantee-archive-view";
import { getSkeapCapacityCount, getSkeapMaxSlots, lockSkeapCapacity } from "@/lib/skeap-capacity";
import { reindexSkeapWaitlist } from "@/lib/skeap-waitlist";
import {
  GRANTEE_PLACEHOLDER_SCHOOL,
  GRANTEE_PLACEHOLDER_YEAR_LEVEL,
} from "@/lib/grantee-profile";

const ALLOWED_ROLES: Role[] = [Role.YOUTH, Role.GRANTEE, Role.SK_OFFICIAL, Role.SUPER_ADMIN];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await ensureProfile(user);

    if (!actor || actor.role !== Role.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "Only SUPER_ADMIN can update user roles." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const requestedRole = String(body?.role ?? "").trim() as Role;
    const rawForwardedFor = request.headers.get("x-forwarded-for") || "";
    const ipAddress = rawForwardedFor.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    if (!ALLOWED_ROLES.includes(requestedRole)) {
      return NextResponse.json({ error: "Invalid role value." }, { status: 400 });
    }

    const { id } = await params;
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, fullName: true, email: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (target.id === actor.id && requestedRole !== Role.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "You cannot remove your own SUPER_ADMIN role." },
        { status: 400 }
      );
    }

    if (requestedRole === Role.GRANTEE) {
      const [hasApprovedApplication, hasWaitlistedApplication] = await Promise.all([
        prisma.skeapApplication.count({ where: { userId: target.id, status: "APPROVED" } }),
        prisma.skeapApplication.count({ where: { userId: target.id, status: "WAITLISTED" } }),
      ]);
      if (hasWaitlistedApplication > 0 && hasApprovedApplication === 0) {
        return NextResponse.json(
          { error: "Waitlisted users must be promoted from the waitlist before receiving the GRANTEE role." },
          { status: 409 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      if (requestedRole === Role.GRANTEE) {
        await lockSkeapCapacity(tx);
        const maxSlots = await getSkeapMaxSlots(tx);
        const existingGrantee = await tx.grantee.findUnique({
          where: { userId: target.id },
          select: { status: true },
        });
        const alreadyOccupiesSlot =
          existingGrantee?.status === "ACTIVE" || existingGrantee?.status === "PROBATIONARY";
        if (!alreadyOccupiesSlot && (await getSkeapCapacityCount(tx, target.id)) >= maxSlots) {
          const applicationsToWaitlist = await tx.skeapApplication.findMany({
            where: {
              userId: target.id,
              status: { in: ["PENDING", "APPROVED"] },
            },
            orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
            select: { id: true, status: true },
          });
          let waitlistPosition =
            (await tx.skeapApplication.count({ where: { status: "WAITLISTED" } })) + 1;
          for (const application of applicationsToWaitlist) {
            await tx.skeapApplication.update({
              where: { id: application.id },
              data: { status: "WAITLISTED", waitlistPosition },
            });
            await writeAuditLog(tx, {
              action: "APPLICATION_ADDED_TO_WAITLIST",
              actorId: actor.id,
              targetTable: "skeap_applications",
              targetId: application.id,
              beforeData: { status: application.status },
              afterData: { status: "WAITLISTED", waitlistPosition },
              metadata: { target: target.id, reason: "Scholarship capacity limit reached" },
            });
            waitlistPosition += 1;
          }
          if (applicationsToWaitlist.length > 0) {
            await tx.user.update({ where: { id: target.id }, data: { role: Role.YOUTH } });
            await reindexSkeapWaitlist(tx);
          }
          return {
            capacityFull: true as const,
            applicationWaitlisted: applicationsToWaitlist.length > 0,
            user: null,
            granteeStatusChanged: false,
          };
        }
      }

      let granteeStatusChanged = false;
      const nextUser = await tx.user.update({
        where: { id: target.id },
        data: { role: requestedRole },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          updatedAt: true,
          grantee: {
            select: {
              id: true,
              school: true,
              yearLevel: true,
              status: true,
            },
          },
        },
      });

      if (requestedRole === Role.GRANTEE) {
        granteeStatusChanged = nextUser.grantee?.status === "REMOVED";
        const grantee = await tx.grantee.upsert({
          where: { userId: target.id },
          create: {
            userId: target.id,
            school: GRANTEE_PLACEHOLDER_SCHOOL,
            yearLevel: GRANTEE_PLACEHOLDER_YEAR_LEVEL,
            status: "ACTIVE",
          },
          update: nextUser.grantee?.status === "REMOVED"
            ? {
                status: "ACTIVE",
                dateRemoved: null,
              }
            : {},
          select: { status: true },
        });
        if (nextUser.grantee?.status === "REMOVED") {
          await writeAuditLog(tx, {
            action: "GRANTEE_STATUS_CHANGED",
            actorId: actor.id,
            targetTable: "grantees",
            targetId: nextUser.grantee.id,
            beforeData: { status: "REMOVED" },
            afterData: { status: grantee.status },
            metadata: {
              target: target.id,
              targetUserName: target.fullName,
              targetUserEmail: target.email,
              reason: "Reinstated when user role was changed to GRANTEE",
            },
          });
        }
      } else if (nextUser.grantee && nextUser.grantee.status !== "GRADUATED") {
        await tx.grantee.update({
          where: { userId: target.id },
          data: {
            status: "REMOVED",
            dateRemoved: new Date(),
          },
        });
        granteeStatusChanged = true;
      }

      await writeAuditLog(tx, {
        action: "UPDATE_USER_ROLE",
        actorId: actor.id,
        targetTable: "users",
        targetId: target.id,
        beforeData: {
          role: target.role,
          fullName: target.fullName,
          email: target.email,
        },
        afterData: {
          role: requestedRole,
          fullName: target.fullName,
          email: target.email,
        },
        metadata: {
          targetUserId: target.id,
          targetUserName: target.fullName,
          targetUserEmail: target.email,
          oldRole: target.role,
          newRole: requestedRole,
          ipAddress,
          userAgent,
        },
      });

      return { capacityFull: false as const, user: nextUser, granteeStatusChanged };
    });

    if (result.capacityFull) {
      return NextResponse.json(
        {
          error: result.applicationWaitlisted
            ? "All 55 slots are filled; this applicant was moved to the waitlist."
            : "All 55 SKEAP scholarship slots are filled.",
        },
        { status: 409 }
      );
    }

    if (result.granteeStatusChanged) {
      try {
        await refreshInactiveGranteesView();
      } catch (error) {
        console.error("User role was updated, but the grantee archive view could not be refreshed:", error);
        return NextResponse.json(
          { error: "User role was updated, but the grantee archive report could not be refreshed." },
          { status: 503 }
        );
      }
    }

    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update role";
    if (message === "SKEAP_CAPACITY_FULL") {
      return NextResponse.json({ error: "All 55 SKEAP scholarship slots are filled." }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
