import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";

const db = prisma; // explicit db variable as requested

export async function PATCH(request: Request, context: any) {
  const maybeParams = context?.params;
  const paramsObj = maybeParams && typeof maybeParams.then === "function" ? await maybeParams : maybeParams;
  const id = paramsObj?.id as string | undefined;

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
    const existsRes: any = await db.$queryRawUnsafe(`SELECT to_regclass('public.accounting_payouts') IS NOT NULL AS exists`);
    const exists = Array.isArray(existsRes) && existsRes[0] && existsRes[0].exists;
    if (!exists) {
      return NextResponse.json({ ok: false, error: 'accounting_payouts table does not exist. Create it or run prisma migrations.' }, { status: 501 });
    }

    try {
      const claimed = typeof body?.claimed === 'boolean' ? body.claimed : true;

      // read before state
      const before = await db.accountingPayout.findUnique({ where: { granteeId: id } });

      if (claimed) {
        // create or mark claimed
        await db.accountingPayout.upsert({
          where: { granteeId: id },
          update: { amount: 5000, claimedAt: new Date(), semester: semester ?? undefined },
          create: { granteeId: id, amount: 5000, semester: semester ?? undefined, claimedAt: new Date() },
        });
      } else {
        // unclaim: set claimedAt = null if a record exists
        await db.accountingPayout.updateMany({
          where: { granteeId: id },
          data: { claimedAt: null },
        });
      }

      // read after state
      const after = await db.accountingPayout.findUnique({ where: { granteeId: id } });

      // write audit log
      try {
        await writeAuditLog(db, {
          action: claimed ? 'Mark payout claimed' : 'Unmark payout claimed',
          actorId: appUser.id,
          targetTable: 'accounting_payouts',
          targetId: id,
          beforeData: before ?? null,
          afterData: after ?? null,
        });
      } catch (logErr) {
        // don't fail the request if audit logging fails, but log
        console.error('Failed to write audit log for payout:', logErr);
      }
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
