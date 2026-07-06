import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function GET() {
  try {
    const [youthCount, activeScholarCount] = await Promise.all([
      prisma.user.count({
        where: {
          role: { in: [Role.YOUTH, Role.GRANTEE] },
          isActive: true,
        },
      }),
      prisma.grantee.count({
        where: {
          status: "ACTIVE",
        },
      }),
    ]);

    return NextResponse.json({ youthCount, activeScholarCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load homepage metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
