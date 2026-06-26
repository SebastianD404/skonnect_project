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
    console.error("Failed to fetch announcements:", {
      message: errorMessage,
      stack,
      error,
    });
    return NextResponse.json(
      {
        error: "Failed to fetch announcements",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? stack : undefined,
      },
      { status: 500 }
    );
  }
}
