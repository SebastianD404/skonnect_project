import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Use `db` as the database connection variable name per project convention
const db = prisma;

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const tb = Number(body.totalBudget ?? 0);
    if (!Number.isFinite(tb)) {
      return NextResponse.json({ ok: false, error: "invalid totalBudget" }, { status: 400 });
    }

    // Use Prisma upsert for type-safe persistence to the adminSettings model.
    // This requires adding `AdminSettings` model to your schema.prisma.
    // use a consistent key for the default budget record
    await db.adminSettings.upsert({
      where: { key: 'default_budget' },
      update: { totalBudget: tb },
      create: { key: 'default_budget', totalBudget: tb },
    });

    return NextResponse.json({ ok: true, totalBudget: tb });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const row = await db.adminSettings.findUnique({ where: { key: 'default_budget' } });
    if (row) return NextResponse.json({ totalBudget: Number.isFinite(row.totalBudget) ? row.totalBudget : 0 });
    return NextResponse.json({ totalBudget: 0 });
  } catch (error) {
    return NextResponse.json({ totalBudget: 0 });
  }
}
