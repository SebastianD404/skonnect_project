import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";

async function authorizeUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return { error: NextResponse.json({ error: "User not found" }, { status: 404 }) };
  }

  if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
    return {
      error: NextResponse.json(
        { error: "Only SK officials can delete grantees" },
        { status: 403 }
      ),
    };
  }

  return { user: appUser };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing grantee id" }, { status: 400 });
    }

    const auth = await authorizeUser();
    if (auth.error) {
      return auth.error;
    }

    const body = await req.json().catch(() => ({}));
    const nextStatus = typeof body?.status === "string" ? body.status.trim().toUpperCase() : undefined;
    if (nextStatus === "GRADUATED") {
      return NextResponse.json(
        { error: "Use the graduation endpoint to timestamp graduation and reclaim the scholarship slot." },
        { status: 409 }
      );
    }
    const allowedStatuses = ["ACTIVE", "REMOVED"];

    if (!nextStatus || !allowedStatuses.includes(nextStatus)) {
      return NextResponse.json({ error: "Invalid grantee status" }, { status: 400 });
    }

    const grantee = await prisma.grantee.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!grantee) {
      return NextResponse.json({ error: "Grantee not found" }, { status: 404 });
    }
    if (grantee.status === "GRADUATED") {
      return NextResponse.json({ error: "Graduated grantee records are locked for statutory retention." }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.grantee.findUnique({
        where: { id },
        select: { id: true, userId: true, status: true },
      });
      if (!current) throw new Error("GRANTEE_NOT_FOUND");
      if (current.status === "GRADUATED") throw new Error("GRANTEE_ARCHIVED");

      const updateResult = await tx.grantee.updateMany({
        where: { id, status: { not: "GRADUATED" } },
        data: {
          status: nextStatus as "ACTIVE" | "REMOVED",
          ...(nextStatus === "ACTIVE" ? { graduatedAt: null } : {}),
        },
      });
      if (updateResult.count !== 1) throw new Error("GRANTEE_ARCHIVED");

      const saved = await tx.grantee.findUnique({
        where: { id },
        select: { id: true, userId: true, status: true, graduatedAt: true },
      });
      if (!saved) throw new Error("GRANTEE_NOT_FOUND");

      await writeAuditLog(tx as any, {
        action: "MUTATE_GRANTEE_STATUS",
        actorId: auth.user.id,
        targetTable: "grantees",
        targetId: id,
        beforeData: { status: current.status },
        afterData: { status: saved.status },
        metadata: {
          target: current.userId,
          targetId: id,
          status: saved.status,
        },
      });

      return saved;
    });

    return NextResponse.json({ success: true, grantee: updated });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === "GRANTEE_ARCHIVED") {
      return NextResponse.json({ error: "Graduated grantee records are locked for statutory retention." }, { status: 409 });
    }
    console.error("Failed to update grantee status:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to update grantee status", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing grantee id" }, { status: 400 });
    }

    const auth = await authorizeUser();
    if (auth.error) {
      return auth.error;
    }

    const grantee = await prisma.grantee.findUnique({ where: { id }, select: { status: true } });
    if (!grantee) {
      return NextResponse.json({ error: "Grantee not found" }, { status: 404 });
    }
    if (grantee.status === "GRADUATED") {
      return NextResponse.json({ error: "Graduated grantee records cannot be deleted during statutory retention." }, { status: 409 });
    }

    const deleteResult = await prisma.grantee.deleteMany({
      where: { id, status: { not: "GRADUATED" } },
    });
    if (deleteResult.count !== 1) {
      return NextResponse.json({ error: "Graduated grantee records cannot be deleted during statutory retention." }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to delete grantee:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to delete grantee", details: errorMessage },
      { status: 500 }
    );
  }
}
