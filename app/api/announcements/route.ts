import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("Fetching announcements...");
    console.log("Prisma client available:", !!prisma);
    console.log("Prisma announcement model available:", !!prisma.announcement);

    const announcements = await prisma.announcement.findMany({
      where: {
        isPublished: true,
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        publishedAt: "desc",
      },
    });

    console.log(`Successfully fetched ${announcements.length} announcements`);
    return NextResponse.json(announcements);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : "";
    // Log full details server-side for troubleshooting
    console.error("Failed to fetch announcements:", {
      message: errorMessage,
      stack,
      error,
    });

    // Don't surface a 500 to clients — treat as no announcements available
    // to avoid noisy console.errors in the browser while keeping server logs.
    return NextResponse.json([], { status: 200 });
  }
}
