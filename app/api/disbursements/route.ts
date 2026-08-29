import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma; // explicit db variable as requested

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const semester = url.searchParams.get("semester");

    // Build query: pick latest submission semester per grantee when available
    let rows: Array<Record<string, any>> = [];

    if (semester) {
      rows = await db.$queryRawUnsafe(
        `SELECT DISTINCT ON (g.id) g.id::text AS id, u."fullName" AS student_name, COALESCE(s.semester, '') AS semester,
          CASE WHEN p.claimed_at IS NOT NULL THEN 'Received' ELSE 'Pending' END AS payout_status
         FROM grantees g
         JOIN users u ON u.id = g."userId"
         LEFT JOIN submissions s ON s."granteeId" = g.id
         LEFT JOIN accounting_payouts p ON p."granteeId" = g.id
         WHERE s.semester = $1
         ORDER BY g.id, s."submittedAt" DESC`,
        semester
      );
    } else {
      rows = await db.$queryRawUnsafe(
        `SELECT DISTINCT ON (g.id) g.id::text AS id, u."fullName" AS student_name, COALESCE(s.semester, '') AS semester,
          CASE WHEN p.claimed_at IS NOT NULL THEN 'Received' ELSE 'Pending' END AS payout_status
         FROM grantees g
         JOIN users u ON u.id = g."userId"
         LEFT JOIN submissions s ON s."granteeId" = g.id
         LEFT JOIN accounting_payouts p ON p."granteeId" = g.id
         ORDER BY g.id, s."submittedAt" DESC`
      );
    }

    return NextResponse.json({ grantees: rows });
  } catch (error) {
    return NextResponse.json({ grantees: [] });
  }
}
