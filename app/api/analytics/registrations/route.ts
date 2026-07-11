import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const monthLabels = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

export async function GET() {
  try {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);

    const rows: Array<{ month: string; count: number }> = await prisma.$queryRawUnsafe(
      `SELECT to_char(date_trunc('month', "submittedAt"), 'MM') AS month, COUNT(*)::int AS count
       FROM "kk_profiling_registrations"
       WHERE "submittedAt" >= $1 AND "submittedAt" < $2
       GROUP BY 1
       ORDER BY 1`,
      yearStart.toISOString(),
      nextYearStart.toISOString()
    );

    const result = monthLabels.map((label, index) => {
      const row = rows.find((r) => r.month === String(index + 1).padStart(2, "0"));
      return {
        month: label,
        count: row?.count ?? 0,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to load youth registration analytics:", error);
    return NextResponse.json(
      monthLabels.map((month) => ({ month, count: 0 })),
      { status: 200 }
    );
  }
}
