import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function getActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const actor = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { id: true, role: true, fullName: true, email: true },
  });

  if (!actor || actor.role !== Role.SUPER_ADMIN) {
    return {
      error: NextResponse.json(
        { error: "Only SUPER_ADMIN can manage users." },
        { status: 403 }
      ),
    };
  }

  return { actor };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actorResult = await getActor();
    if ("error" in actorResult) return actorResult.error;
    const { actor } = actorResult;

    const { id } = await params;
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, email: true, role: true, isActive: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const body = await request.json();
    const nextFullName =
      typeof body?.fullName === "string" ? body.fullName.trim() : undefined;
    const nextEmail = typeof body?.email === "string" ? body.email.trim() : undefined;
    const nextIsActive =
      typeof body?.isActive === "boolean" ? body.isActive : undefined;

    if (
      typeof nextFullName === "undefined" &&
      typeof nextEmail === "undefined" &&
      typeof nextIsActive === "undefined"
    ) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    if (typeof nextFullName !== "undefined" && nextFullName.length < 2) {
      return NextResponse.json(
        { error: "Full name must be at least 2 characters." },
        { status: 400 }
      );
    }

    if (
      typeof nextEmail !== "undefined" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)
    ) {
      return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
    }

    if (target.id === actor.id && nextIsActive === false) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 }
      );
    }

    const existingUserWithEmail =
      typeof nextEmail !== "undefined"
        ? await prisma.user.findFirst({
            where: {
              email: nextEmail,
              NOT: { id: target.id },
            },
            select: { id: true },
          })
        : null;

    if (existingUserWithEmail) {
      return NextResponse.json(
        { error: "Email is already used by another account." },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: target.id },
        data: {
          ...(typeof nextFullName !== "undefined" ? { fullName: nextFullName } : {}),
          ...(typeof nextEmail !== "undefined" ? { email: nextEmail } : {}),
          ...(typeof nextIsActive !== "undefined" ? { isActive: nextIsActive } : {}),
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: typeof nextIsActive === "boolean" ? "UPDATE_USER_STATUS" : "UPDATE_USER_PROFILE",
          targetTable: "users",
          targetId: target.id,
          beforeData: {
            fullName: target.fullName,
            email: target.email,
            role: target.role,
            isActive: target.isActive,
          },
          afterData: {
            fullName: updated.fullName,
            email: updated.email,
            role: updated.role,
            isActive: updated.isActive,
          },
        },
      });

      return nextUser;
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actorResult = await getActor();
    if ("error" in actorResult) return actorResult.error;
    const { actor } = actorResult;

    const { id } = await params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, fullName: true, email: true, role: true, isActive: true },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (target.id === actor.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "DELETE_USER",
          targetTable: "users",
          targetId: target.id,
          beforeData: {
            fullName: target.fullName,
            email: target.email,
            role: target.role,
            isActive: target.isActive,
          },
          afterData: Prisma.JsonNull,
        },
      });

      await tx.user.delete({ where: { id: target.id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete user. This user may have related records.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
