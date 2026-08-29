import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma; // explicit db variable as requested

export async function PATCH(req: Request, context: any) {
  const maybeParams = context?.params;
  const paramsObj = maybeParams && typeof maybeParams.then === "function" ? await maybeParams : maybeParams;
  const id = paramsObj?.id as string | undefined;

  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  }

  try {
    // Check if accounting_payouts table exists
    const existsRes: any = await db.$queryRawUnsafe(`SELECT to_regclass('public.accounting_payouts') IS NOT NULL AS exists`);
    const exists = Array.isArray(existsRes) && existsRes[0] && existsRes[0].exists;
    if (!exists) {
      return NextResponse.json({ ok: false, error: 'accounting_payouts table does not exist. Create it or run prisma migrations.' }, { status: 501 });
    }

    // Use Prisma upsert to create or update the AccountingPayout (unique by granteeId)
    await db.accountingPayout.upsert({
      where: { granteeId: id },
      update: { amount: 5000, claimedAt: new Date() },
      create: { granteeId: id, amount: 5000, claimedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
