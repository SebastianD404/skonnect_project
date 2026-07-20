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
    const allowedStatuses = ["ACTIVE", "GRADUATED", "REMOVED"];

    if (!nextStatus || !allowedStatuses.includes(nextStatus)) {
      return NextResponse.json({ error: "Invalid grantee status" }, { status: 400 });
    }

    const grantee = await prisma.grantee.findUnique({ where: { id } });
    if (!grantee) {
      return NextResponse.json({ error: "Grantee not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await (tx as any).grantee.update({
        where: { id },
        data: { status: nextStatus as "ACTIVE" | "GRADUATED" | "REMOVED" },
      });

      await writeAuditLog(tx as any, {
        action: "MUTATE_GRANTEE_STATUS",
        actorId: auth.user.id,
        targetTable: "grantees",
        targetId: id,
        beforeData: { status: grantee.status },
        afterData: { status: saved.status },
        metadata: {
          target: grantee.userId,
          targetId: id,
          status: saved.status,
        },
      });

      return saved;
    });

    return NextResponse.json({ success: true, grantee: updated });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
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

    const grantee = await prisma.grantee.findUnique({ where: { id } });
    if (!grantee) {
      return NextResponse.json({ error: "Grantee not found" }, { status: 404 });
    }

    await prisma.grantee.delete({ where: { id } });
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
