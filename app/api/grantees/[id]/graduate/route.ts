import { GranteeStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { hasGranteeRetentionColumn, prisma } from "@/lib/prisma";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing grantee id" }, { status: 400 });

  try {
    const hasRetentionColumn = await hasGranteeRetentionColumn();
    const graduatedGrantee = await prisma.$transaction(async (tx) => {
      const grantee = await tx.grantee.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          user: { select: { fullName: true } },
        },
      });

      if (!grantee) throw new Error("GRANTEE_NOT_FOUND");
      if (grantee.status !== GranteeStatus.ACTIVE && grantee.status !== GranteeStatus.PROBATIONARY) {
        throw new Error("GRANTEE_NOT_ACTIVE");
      }

      const graduatedAt = new Date();
      const retentionExpiresAt = getRetentionExpiryDate({ graduatedAt })!;
      const updateResult = await tx.grantee.updateMany({
        where: {
          id,
          status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
        },
        data: {
          status: GranteeStatus.GRADUATED,
          graduatedAt,
          ...(hasRetentionColumn ? { retentionExpiresAt } : {}),
        },
      });
      if (updateResult.count !== 1) throw new Error("GRANTEE_NOT_ACTIVE");

      await tx.adminNotification.create({
        data: {
          title: "Scholarship Slot Freed",
          message: `${grantee.user.fullName} has graduated. 1 slot is now available for the waitlist.`,
          type: "SLOT_RECLAIMED",
        },
      });

      return { id: grantee.id, status: GranteeStatus.GRADUATED, graduatedAt, retentionExpiresAt };
    });

    return NextResponse.json({ success: true, grantee: graduatedGrantee });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to graduate grantee.";
    if (message === "GRANTEE_NOT_FOUND") {
      return NextResponse.json({ error: "Grantee not found." }, { status: 404 });
    }
    if (message === "GRANTEE_NOT_ACTIVE") {
      return NextResponse.json({ error: "Only active grantees can be marked as graduated." }, { status: 409 });
    }
    console.error("Failed to graduate grantee:", error);
    return NextResponse.json({ error: "Failed to mark grantee as graduated." }, { status: 500 });
  }
}