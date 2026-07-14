import { prisma } from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit/logger";

export async function GET(
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

    const appUser = await ensureProfile(user);

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SK officials can view event attendance" },
        { status: 403 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        registrations: {
          orderBy: {
            registeredAt: "desc",
          },
          select: {
            id: true,
            registeredAt: true,
            user: {
              select: {
                fullName: true,
                email: true,
                role: true,
                phoneNumber: true,
                barangay: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const participants = event.registrations.map((registration) => ({
      id: registration.id,
      name: registration.user.fullName,
      email: registration.user.email,
      role: registration.user.role,
      contact: registration.user.phoneNumber,
      barangay: registration.user.barangay,
      registeredAt: registration.registeredAt.toISOString(),
    }));

    return NextResponse.json({
      eventId: event.id,
      eventTitle: event.title,
      participants,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to fetch event attendance:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to fetch event attendance", details: errorMessage },
      { status: 500 }
    );
  }
}

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

    const appUser = await ensureProfile(user);

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const allowedRoles = ["YOUTH", "GRANTEE"];
    const userRole = appUser.role?.toUpperCase() || "";

    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Forbidden: Grantees and Youth accounts only are permitted to register for programs." },
        { status: 403 }
      );
    }

    // Check if user has completed and approved KK profiling
    const kkProfile = await prisma.user.findUnique({
      where: { id: appUser.id },
      select: { kkProfileId: true },
    });

    if (!kkProfile?.kkProfileId) {
      return NextResponse.json(
        { error: "You must complete KK profiling first before registering for events." },
        { status: 403 }
      );
    }

    // Check if the latest KK profiling registration is approved
    const latestRegistration = await prisma.profilingRegistration.findFirst({
      where: { userId: appUser.id },
      orderBy: { submittedAt: "desc" },
      select: { reviewStatus: true },
    });

    if (latestRegistration?.reviewStatus !== "Approved") {
      return NextResponse.json(
        { error: "Your KK profiling registration must be approved before you can register for events." },
        { status: 403 }
      );
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

    const appUser = await ensureProfile(user);

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

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.event.update({
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

      await writeAuditLog(tx, {
        action: status && status !== event.status ? "CANCEL_EVENT" : "UPDATE_EVENT",
        actorId: appUser.id,
        targetTable: "events",
        targetId: id,
        beforeData: {
          title: event.title,
          venue: event.venue,
          eventDate: event.eventDate,
          status: event.status,
        },
        afterData: {
          title: saved.title,
          venue: saved.venue,
          eventDate: saved.eventDate,
          status: saved.status,
        },
        metadata: {
          target: saved.title,
          targetId: id,
          status: saved.status,
        },
      });

      return saved;
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

    const appUser = await ensureProfile(user);

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

    await prisma.$transaction(async (tx) => {
      await tx.event.delete({
        where: { id },
      });

      await writeAuditLog(tx, {
        action: "DELETE_EVENT",
        actorId: appUser.id,
        targetTable: "events",
        targetId: id,
        beforeData: {
          title: event.title,
          venue: event.venue,
          eventDate: event.eventDate,
          status: event.status,
        },
        afterData: null,
        metadata: {
          target: event.title,
          targetId: id,
        },
      });
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
