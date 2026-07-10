import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let appUserId: string | null = null;
    if (user) {
      const appUser = await ensureProfile(user);
      if (appUser) appUserId = appUser.id;
    }

    const events = await prisma.event.findMany({
      where: {
        status: {
          in: ["UPCOMING", "REGISTRATION_OPEN"],
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        registrations: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
      orderBy: {
        eventDate: "asc",
      },
    });

    const formattedEvents = events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      venue: event.venue,
      eventDate: event.eventDate,
      maxSlots: event.maxSlots,
      filledSlots: event.registrations.length,
      status: event.status,
      isKatipunan: event.isKatipunan,
      imageUrl: event.imageUrl || null,
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      isRegistered: appUserId ? event.registrations.some((r) => r.userId === appUserId) : false,
    }));

    // Log image URLs for debugging
    console.log("Events with images:", formattedEvents.map(e => ({ 
      title: e.title, 
      hasImage: !!e.imageUrl,
      imageUrl: e.imageUrl?.substring(0, 80) + "..." 
    })));

    return NextResponse.json(formattedEvents);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to fetch events:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to fetch events", details: errorMessage },
      { status: 500 }
    );
  }
}
