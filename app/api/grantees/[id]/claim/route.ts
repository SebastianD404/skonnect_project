import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma; // explicit db variable

export async function PATCH(request: Request, context: any) {
  const maybeParams = context?.params;
  const paramsObj = maybeParams && typeof maybeParams.then === "function" ? await maybeParams : maybeParams;
  const id = paramsObj?.id as string | undefined;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
  }

  try {
    // Use Prisma upsert for a safe write that creates or updates the accounting_payouts row
    await db.accountingPayout.upsert({
      where: { granteeId: id },
      update: { amount: 5000, claimedAt: new Date() },
      create: { granteeId: id, amount: 5000, claimedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
