import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma;

export async function GET() {
  try {
    // Use Prisma to read the AdminSettings value
    const row = await db.adminSettings.findUnique({ where: { key: 'totalBudget' } });
    if (row) return NextResponse.json({ totalBudget: Number.isFinite(row.totalBudget) ? row.totalBudget : 0 });
    return NextResponse.json({ totalBudget: 0 });
  } catch (error) {
    // If the table doesn't exist, return default
    return NextResponse.json({ totalBudget: 0 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const tb = Number(body.totalBudget ?? 0);
    if (!Number.isFinite(tb)) {
      return NextResponse.json({ ok: false, error: 'invalid totalBudget' }, { status: 400 });
    }

    // Use Prisma upsert on the adminSettings model
    await db.adminSettings.upsert({
      where: { key: 'totalBudget' },
      update: { totalBudget: tb },
      create: { key: 'totalBudget', totalBudget: tb },
    });

    return NextResponse.json({ ok: true, totalBudget: tb });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 501 });
  }
}
