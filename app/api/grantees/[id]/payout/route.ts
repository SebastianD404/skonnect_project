import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";

const db = prisma; // explicit db variable as requested

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  }

  try {
    // authenticate actor (must be SK_OFFICIAL or SUPER_ADMIN)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const appUser = await ensureProfile(user);
    if (!appUser) return NextResponse.json({ ok: false, error: 'User not found' }, { status: 401 });
    if (appUser.role !== 'SK_OFFICIAL' && appUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const semester = typeof body?.semester === 'string' ? body.semester : null;

    // Try to insert with semester column if present; fall back to simple insert
    // Ensure accounting_payouts table exists
    const existsRes = await db.$queryRaw<Array<{ exists: boolean }>>`SELECT to_regclass('public.accounting_payouts') IS NOT NULL AS exists`;
    const exists = Array.isArray(existsRes) && existsRes[0] && existsRes[0].exists;
    if (!exists) {
      return NextResponse.json({ ok: false, error: 'accounting_payouts table does not exist. Create it or run prisma migrations.' }, { status: 501 });
    }

    try {
      const claimed = typeof body?.claimed === 'boolean' ? body.claimed : true;

      await db.$transaction(async (tx) => {
        const before = await tx.accountingPayout.findUnique({ where: { granteeId: id } });

        if (claimed) {
          await tx.accountingPayout.upsert({
            where: { granteeId: id },
            update: { amount: 5000, claimedAt: new Date(), semester: semester ?? undefined },
            create: { granteeId: id, amount: 5000, semester: semester ?? undefined, claimedAt: new Date() },
          });
        } else {
          await tx.accountingPayout.updateMany({
            where: { granteeId: id },
            data: { claimedAt: null },
          });
        }

        const after = await tx.accountingPayout.findUnique({ where: { granteeId: id } });
        await writeAuditLog(tx, {
          action: claimed ? "Mark payout claimed" : "Unmark payout claimed",
          actorId: appUser.id,
          targetTable: "accounting_payouts",
          targetId: id,
          beforeData: before ?? null,
          afterData: after ?? null,
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
