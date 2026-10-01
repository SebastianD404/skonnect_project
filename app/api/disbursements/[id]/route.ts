import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";

const db = prisma; // explicit db variable as requested

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const actor = await ensureProfile(user);
    if (!actor || (actor.role !== Role.SK_OFFICIAL && actor.role !== Role.SUPER_ADMIN)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Check if accounting_payouts table exists
    const existsRes = await db.$queryRaw<Array<{ exists: boolean }>>`SELECT to_regclass('public.accounting_payouts') IS NOT NULL AS exists`;
    const exists = Array.isArray(existsRes) && existsRes[0] && existsRes[0].exists;
    if (!exists) {
      return NextResponse.json({ ok: false, error: 'accounting_payouts table does not exist. Create it or run prisma migrations.' }, { status: 501 });
    }

    await db.$transaction(async (tx) => {
      const before = await tx.accountingPayout.findUnique({ where: { granteeId: id } });
      await tx.accountingPayout.upsert({
        where: { granteeId: id },
        update: { amount: 5000, claimedAt: new Date() },
        create: { granteeId: id, amount: 5000, claimedAt: new Date() },
      });
      const after = await tx.accountingPayout.findUnique({ where: { granteeId: id } });
      await writeAuditLog(tx, {
        action: "Mark payout claimed",
        actorId: actor.id,
        targetTable: "accounting_payouts",
        targetId: id,
        beforeData: before,
        afterData: after,
        metadata: { source: "disbursements_endpoint" },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
