import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApprovedKkProfileCount } from "@/lib/approved-kk-profile-count";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [approvedKkProfileCount, activeScholarCount] = await Promise.all([
      getApprovedKkProfileCount(),
      prisma.grantee.count({
        where: {
          status: "ACTIVE",
        },
      }),
    ]);

    return NextResponse.json(
      { approvedKkProfileCount, activeScholarCount },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load homepage metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
