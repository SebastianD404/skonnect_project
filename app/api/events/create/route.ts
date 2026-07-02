import { prisma } from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SK officials can create events" },
        { status: 403 }
      );
    }

    const { title, description, venue, eventDate, maxSlots, isKatipunan, imageUrl } =
      await req.json();

    const slots = Number(maxSlots);
    const imageValue = imageUrl === "" ? null : imageUrl ?? null;

    if (!title?.trim() || !description?.trim() || !venue?.trim()) {
      return NextResponse.json(
        { error: "Title, description, and venue are required" },
        { status: 400 }
      );
    }

    if (!eventDate || !slots || slots < 1) {
      return NextResponse.json(
        { error: "Event date and valid max slots are required" },
        { status: 400 }
      );
    }

    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        venue: venue.trim(),
        eventDate: new Date(eventDate),
        maxSlots: slots,
        imageUrl: imageValue,
        isKatipunan: isKatipunan || false,
        createdById: appUser.id,
        status: "UPCOMING",
      },
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to create event:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to create event", details: errorMessage },
      { status: 500 }
    );
  }
}
