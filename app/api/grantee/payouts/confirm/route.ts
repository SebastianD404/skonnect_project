import { AccountingPayoutStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUser = await ensureProfile(user);
  if (!appUser || appUser.role !== Role.GRANTEE) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const payoutId = typeof body?.payoutId === "string" ? body.payoutId.trim() : "";
  if (!payoutId || payoutId.length > 100) {
    return NextResponse.json({ error: "A valid payout ID is required." }, { status: 400 });
  }

  const grantee = await prisma.grantee.findUnique({
    where: { userId: appUser.id },
    select: { id: true },
  });
  if (!grantee) return NextResponse.json({ error: "Grantee record not found." }, { status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    const payout = await tx.accountingPayout.findFirst({
      where: { id: payoutId, granteeId: grantee.id },
    });
    if (!payout) return { error: "Payout not found.", status: 404 as const };
    if (payout.status === AccountingPayoutStatus.CONFIRMED) {
      return { payout, alreadyConfirmed: true as const };
    }
    if (payout.status !== AccountingPayoutStatus.DISBURSED_UNCONFIRMED) {
      return { error: "This payout has not been marked as disbursed.", status: 409 as const };
    }

    const claimedAt = new Date();
    const updated = await tx.accountingPayout.updateMany({
      where: {
        id: payout.id,
        granteeId: grantee.id,
        status: AccountingPayoutStatus.DISBURSED_UNCONFIRMED,
      },
      data: { status: AccountingPayoutStatus.CONFIRMED, claimedAt },
    });
    if (updated.count !== 1) {
      const current = await tx.accountingPayout.findUnique({ where: { id: payout.id } });
      if (current?.status === AccountingPayoutStatus.CONFIRMED) {
        return { payout: current, alreadyConfirmed: true as const };
      }
      return { error: "Payout status changed. Refresh and try again.", status: 409 as const };
    }

    const confirmedPayout = await tx.accountingPayout.findUniqueOrThrow({
      where: { id: payout.id },
    });
    await writeAuditLog(tx, {
      action: "PAYOUT_RECEIPT_CONFIRMED",
      actorId: appUser.id,
      targetTable: "accounting_payouts",
      targetId: payout.id,
      beforeData: payout,
      afterData: confirmedPayout,
      metadata: { granteeId: grantee.id, semester: payout.semester },
    });

    return { payout: confirmedPayout, alreadyConfirmed: false as const };
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    status: result.payout.status,
    claimedAt: result.payout.claimedAt,
    alreadyConfirmed: result.alreadyConfirmed,
  });
}
