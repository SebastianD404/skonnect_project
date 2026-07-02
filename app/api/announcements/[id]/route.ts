import { prisma } from "@/lib/prisma";
import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params for Next.js 16+
    const { id } = await params;
    
    // Check if user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user from database
    const appUser = await ensureProfile(user);

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is SK_OFFICIAL or SUPER_ADMIN
    if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SK officials can edit announcements" },
        { status: 403 }
      );
    }

    // Parse request body
    const { title, content, imageUrl } = await req.json();

    // Validate input
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    // Check if announcement exists
    const announcement = await prisma.announcement.findUnique({
      where: { id },
    });

    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // Update announcement
    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        title: title.trim(),
        content: content.trim(),
        imageUrl: imageUrl || null,
        updatedAt: new Date(),
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
    });

    return NextResponse.json(updated);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to update announcement:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to update announcement", details: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params for Next.js 16+
    const { id } = await params;
    
    // Check if user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user from database
    const appUser = await ensureProfile(user);

    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is SK_OFFICIAL or SUPER_ADMIN
    if (appUser.role !== "SK_OFFICIAL" && appUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SK officials can delete announcements" },
        { status: 403 }
      );
    }

    // Check if announcement exists
    const announcement = await prisma.announcement.findUnique({
      where: { id },
    });

    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // Delete announcement
    await prisma.announcement.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to delete announcement:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to delete announcement", details: errorMessage },
      { status: 500 }
    );
  }
}
