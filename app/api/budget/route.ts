import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma;

const normalizeSemester = (value?: string | null) =>
  String(value ?? "").replace(/\s*\(current\)$/i, "").trim();

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const semester = normalizeSemester(url.searchParams.get("semester"));
    const body = await request.json();
    const tb = Number(body.totalBudget ?? 0);

    if (!Number.isFinite(tb)) {
      return NextResponse.json({ ok: false, error: "invalid totalBudget" }, { status: 400 });
    }

    let semesterRow = null as { id: string; name: string } | null;
    if (semester) {
      semesterRow = await db.semester.findFirst({
        where: { name: { equals: semester, mode: "insensitive" } },
        select: { id: true, name: true },
      });
    }

    const key = semester ? `semester_budget:${semesterRow?.id ?? semester}` : "default_budget";

    await db.adminSettings.upsert({
      where: { key },
      update: { totalBudget: tb },
      create: { key, totalBudget: tb },
    });

    return NextResponse.json({ ok: true, totalBudget: tb, semester: semester || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const semester = normalizeSemester(url.searchParams.get("semester"));

    if (semester) {
      const semesterRow = await db.semester.findFirst({
        where: { name: { equals: semester, mode: "insensitive" } },
        select: { id: true, name: true },
      });

      const key = `semester_budget:${semesterRow?.id ?? semester}`;
      const row = await db.adminSettings.findUnique({ where: { key } });

      if (row) {
        return NextResponse.json({
          totalBudget: Number.isFinite(row.totalBudget) ? row.totalBudget : 0,
          semester: semesterRow?.name ?? semester,
        });
      }

      return NextResponse.json({ totalBudget: 0, semester: semesterRow?.name ?? semester });
    }

    const row = await db.adminSettings.findUnique({ where: { key: "default_budget" } });
    if (row) {
      return NextResponse.json({
        totalBudget: Number.isFinite(row.totalBudget) ? row.totalBudget : 0,
        semester: null,
      });
    }

    return NextResponse.json({ totalBudget: 0, semester: null });
  } catch (error) {
    return NextResponse.json({ totalBudget: 0, semester: null });
  }
}
