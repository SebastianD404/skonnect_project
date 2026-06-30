import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    let applicationId: string | undefined = params?.id;

    if (!applicationId) {
      applicationId = request.nextUrl.searchParams.get("id") || undefined;
    }

    if (!applicationId) {
      try {
        const body = await request.json().catch(() => null);
        if (body && typeof body.id === "string") applicationId = body.id;
      } catch (e) {
        // ignore
      }
    }

    if (!applicationId) {
      return NextResponse.json({ error: "Missing application id" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const appUser = await prisma.user.findUnique({ where: { authId: user.id }, select: { id: true } });
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

    // Collect possible file paths to remove from storage
    const bucketName = "public image";
    const urls: string[] = [];

    // Extract URLs from message body
    if (typeof inquiry.message === "string") {
      const matches = Array.from((inquiry.message || "").matchAll(/https?:\/\/[^"]+/g));
      matches.forEach((m) => {
        if (typeof m[0] === "string") urls.push(m[0]);
      });
    }

    // Extract file URLs from reviewThread attachments
    const thread = Array.isArray(inquiry.reviewThread) ? inquiry.reviewThread : [];
    thread.forEach((entry: any) => {
      if (Array.isArray(entry.attachments)) {
        entry.attachments.forEach((att: any) => {
          if (att && typeof att.fileUrl === "string") urls.push(att.fileUrl);
        });
      }
    });

    // Map public URLs back to storage paths. Supabase public URL pattern: {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
    const storagePaths: string[] = [];
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "") + "/storage/v1/object/public/" + encodeURIComponent(bucketName) + "/";

    for (const url of urls) {
      try {
        if (url.startsWith(base)) {
          const path = decodeURIComponent(url.substring(base.length));
          if (path) storagePaths.push(path);
        }
      } catch (e) {
        // ignore
      }
    }

    // Delete files from storage if any
    if (storagePaths.length > 0) {
      try {
        const { error } = await supabase.storage.from(bucketName).remove(storagePaths);
        if (error) {
          console.warn("Failed to remove storage files", { error, storagePaths });
        }
      } catch (e) {
        console.warn("Storage removal failed", e);
      }
    }

    // Remove inquiry row in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.inquiry.delete({ where: { id: applicationId } });
    });

    // Revalidate applicant and admin lists
    try {
      revalidatePath("/applications");
      revalidatePath("/dashboard");
      revalidatePath("/admin/skeap-applications");
      revalidatePath("/admin");
    } catch (err) {
      // non-fatal
      console.warn("Revalidation failed for delete route", err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete application";
    console.error("Delete application error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
