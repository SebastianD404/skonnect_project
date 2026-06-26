import { prisma } from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await prisma.user.findUnique({
      where: { authId: user.id },
      select: { id: true, role: true },
    });

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!["YOUTH", "GRANTEE"].includes(appUser.role)) {
      return NextResponse.json({ error: "Only youth or grantee users can register for events" }, { status: 403 });
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        registrations: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    if (event.filledSlots >= event.maxSlots) {
      return NextResponse.json({ error: "Event is already full" }, { status: 400 });
    }

    const alreadyRegistered = event.registrations.some((registration) => registration.userId === appUser.id);
    if (alreadyRegistered) {
      return NextResponse.json({ error: "Already registered for this event" }, { status: 400 });
    }

    await prisma.registration.create({
      data: {
        eventId: id,
        userId: appUser.id,
      },
    });

    await prisma.event.update({
      where: { id },
      data: { filledSlots: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to register for event:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to register for event", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await prisma.user.findUnique({
      where: { authId: user.id },
      select: { id: true, role: true },
    });

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SK officials can edit events" },
        { status: 403 }
      );
    }

    const { title, description, venue, eventDate, maxSlots, status, imageUrl, isKatipunan } =
      await req.json();

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        title: title?.trim() || event.title,
        description: description?.trim() || event.description,
        venue: venue?.trim() || event.venue,
        eventDate: eventDate ? new Date(eventDate) : event.eventDate,
        maxSlots: maxSlots || event.maxSlots,
        imageUrl: imageUrl !== undefined ? (imageUrl === "" || imageUrl === null ? null : imageUrl) : event.imageUrl,
        isKatipunan: isKatipunan !== undefined ? isKatipunan : event.isKatipunan,
        status: status || event.status,
        updatedAt: new Date(),
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

    return NextResponse.json(updated);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to update event:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to update event", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await prisma.user.findUnique({
      where: { authId: user.id },
      select: { id: true, role: true },
    });

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SK officials can delete events" },
        { status: 403 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await prisma.event.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to delete event:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to delete event", details: errorMessage },
      { status: 500 }
    );
  }
}
