import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
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

    const updated = await prisma.$transaction(async (tx) => {
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
            },
          },
        },
      });

      if (requestedRole === Role.GRANTEE) {
        await tx.grantee.upsert({
          where: { userId: target.id },
          create: {
            userId: target.id,
            school: GRANTEE_PLACEHOLDER_SCHOOL,
            yearLevel: GRANTEE_PLACEHOLDER_YEAR_LEVEL,
            status: "ACTIVE",
          },
          update: {},
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "UPDATE_USER_ROLE",
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
        },
      });

      return nextUser;
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
