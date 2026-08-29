import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma; // explicit db variable as requested

export async function GET() {
  try {
    const semesters = await db.semester.findMany({
      orderBy: [
        { isCurrent: 'desc' },
        { name: 'desc' },
      ],
    });

    return NextResponse.json({ semesters });
  } catch (error) {
    return NextResponse.json({ semesters: [] });
  }
}
