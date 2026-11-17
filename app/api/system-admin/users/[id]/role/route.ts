import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { refreshSystemUsersAdminView } from "@/lib/application-admin-view-refresh";

const GRANTEE_ROLE_ERROR =
  "Grantee status is managed automatically through SKEAP Applications and Active Grantees and cannot be changed manually.";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await ensureProfile(sessionUser);
    if (!actor || actor.role !== Role.SUPER_ADMIN) {
      return NextResponse.json(
        { error: "Only System Admins can update SK Admin access." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const requestedRole = String(body?.role ?? "").trim();

    if (requestedRole === Role.GRANTEE) {
      return NextResponse.json({ error: GRANTEE_ROLE_ERROR }, { status: 400 });
    }
    if (requestedRole !== Role.YOUTH && requestedRole !== Role.SK_OFFICIAL) {
      return NextResponse.json(
        { error: "Only Youth and SK Admin role changes are allowed." },
        { status: 400 },
      );
    }

    const { id: targetUserId } = await params;
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          authId: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          updatedAt: true,
          grantee: { select: { status: true } },
        },
      });

      if (!target) {
        return { ok: false as const, status: 404, error: "User not found." };
      }

      if (
        target.role === Role.SUPER_ADMIN ||
        target.id === actor.id ||
        target.authId === sessionUser.id
      ) {
        return {
          ok: false as const,
          status: 403,
          error: "System Admin accounts and your own account cannot be modified here.",
        };
      }

      const hasActiveGranteeRecord =
        target.grantee?.status === "ACTIVE" ||
        target.grantee?.status === "PROBATIONARY";
      const latestSkeapApplication = !target.grantee
        ? await tx.skeapApplication.findFirst({
            where: { userId: target.id },
            orderBy: [{ updatedAt: "desc" }, { submittedAt: "desc" }],
            select: { status: true },
          })
        : null;
      const hasActiveSkeapApplication = latestSkeapApplication?.status === "APPROVED";

      if (
        target.role === Role.GRANTEE ||
        hasActiveGranteeRecord ||
        hasActiveSkeapApplication
      ) {
        return { ok: false as const, status: 400, error: GRANTEE_ROLE_ERROR };
      }

      if (target.role === requestedRole) {
        return { ok: true as const, user: target };
      }

      const isAllowedTransition =
        (target.role === Role.YOUTH && requestedRole === Role.SK_OFFICIAL) ||
        (target.role === Role.SK_OFFICIAL && requestedRole === Role.YOUTH);
      if (!isAllowedTransition) {
        return {
          ok: false as const,
          status: 400,
          error: "Only Youth and SK Admin role changes are allowed.",
        };
      }

      const previousRole = target.role;
      const newRole = requestedRole as Role;
      const updatedUser = await tx.user.update({
        where: { id: target.id },
        data: { role: newRole },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });
      const timestamp = new Date().toISOString();

      await writeAuditLog(tx, {
        action: "UPDATE_USER_ROLE",
        actorId: actor.id,
        targetTable: "users",
        targetId: target.id,
        beforeData: { role: previousRole },
        afterData: { role: newRole },
        metadata: {
          actorId: actor.id,
          targetUserId: target.id,
          previousRole,
          newRole,
          timestamp,
        },
      });

      return { ok: true as const, user: updatedUser };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await refreshSystemUsersAdminView();
    revalidatePath("/system-admin/users");
    revalidatePath("/system-admin");
    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    console.error("[PATCH /api/system-admin/users/[id]/role]", error);
    return NextResponse.json({ error: "Failed to update SK Admin access." }, { status: 500 });
  }
}
