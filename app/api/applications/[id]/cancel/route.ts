import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    // Accept id from route params, query string, or JSON body for robustness
    let applicationId: string | undefined = params?.id;
    if (!applicationId) {
      applicationId = request.nextUrl.searchParams.get("id") || undefined;
    }

    if (!applicationId) {
      // Try to parse JSON body if present
      try {
        const body = await request.json();
        if (body && typeof body.id === "string") applicationId = body.id;
      } catch (e) {
        // ignore parse errors
      }
    }

    if (!applicationId) {
      console.error("Cancel application: missing id (params, query, body)", { url: request.nextUrl.href });
      return NextResponse.json({ error: "Missing application id" }, { status: 400 });
    }

    console.log("Cancel application request", { applicationId, url: request.nextUrl.href });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const inquiry = await prisma.inquiry.findUnique({ where: { id: applicationId } });
    if (!inquiry) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (inquiry.userId !== appUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.inquiry.update({
      where: { id: applicationId },
      data: { isResolved: true, response: "Cancelled by applicant", respondedAt: new Date(), reviewStatus: "Cancelled" },
    });

    // Invalidate admin listing so cancelled items drop out immediately
    try {
      revalidatePath("/admin/skeap-applications");
      revalidatePath("/admin");
    } catch (err) {
      // non-fatal
      console.warn("Revalidation failed for cancel route", err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel application";
    console.error("Cancel application error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
