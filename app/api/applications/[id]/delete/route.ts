import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { refreshSkeapApplicationsAdminView } from "@/lib/application-admin-view-refresh";

function collectUrls(value: unknown, urls: Set<string>) {
  if (typeof value === "string") {
    for (const url of value.match(/https?:\/\/[^\s"'<>]+/g) ?? []) urls.add(url);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectUrls(entry, urls));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((entry) => collectUrls(entry, urls));
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Missing application id." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

    const appUser = await ensureProfile(user);
    if (!appUser) return NextResponse.json({ error: "User not found." }, { status: 401 });
    if (appUser.role !== Role.YOUTH) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        message: true,
        reviewThread: true,
        application: {
          select: {
            id: true,
            userId: true,
            status: true,
            uploadedFiles: true,
            enrollmentFileUrl: true,
            reportCardFileUrl: true,
            photoFileUrl: true,
          },
        },
      },
    });
    if (!inquiry) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (inquiry.userId !== appUser.id || inquiry.application?.userId !== appUser.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (!inquiry.application || inquiry.application.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Submitted applications cannot be deleted. Withdraw an eligible application instead." },
        { status: 403 },
      );
    }

    const urls = new Set<string>();
    collectUrls(inquiry.message, urls);
    collectUrls(inquiry.reviewThread, urls);
    collectUrls(inquiry.application.uploadedFiles, urls);
    collectUrls(
      [
        inquiry.application.enrollmentFileUrl,
        inquiry.application.reportCardFileUrl,
        inquiry.application.photoFileUrl,
      ],
      urls,
    );

    const bucketName = "public image";
    const storageBase =
      `${(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "")}/storage/v1/object/public/${encodeURIComponent(bucketName)}/`;
    const storagePaths = Array.from(urls)
      .filter((url) => url.startsWith(storageBase))
      .map((url) => {
        try {
          return decodeURIComponent(url.slice(storageBase.length));
        } catch {
          return "";
        }
      })
      .filter(Boolean);

    const deletion = await prisma.skeapApplication.deleteMany({
      where: {
        id: inquiry.application.id,
        userId: appUser.id,
        status: "DRAFT",
      },
    });
    if (deletion.count !== 1) {
      return NextResponse.json(
        { error: "Only an unsubmitted draft can be deleted. The application status may have changed." },
        { status: 403 },
      );
    }

    if (storagePaths.length > 0) {
      try {
        const { error } = await supabase.storage.from(bucketName).remove(storagePaths);
        if (error) console.warn("Failed to remove draft upload files from storage.", { error, storagePaths });
      } catch (storageError) {
        console.warn("Draft was deleted but storage cleanup failed.", { storageError, storagePaths });
      }
    }

    await refreshSkeapApplicationsAdminView();
    try {
      revalidatePath("/applications");
      revalidatePath("/dashboard");
      revalidatePath("/admin/skeap-applications");
      revalidatePath("/admin");
    } catch (revalidationError) {
      console.warn("Draft deletion succeeded but page revalidation failed.", revalidationError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete draft error:", error);
    return NextResponse.json({ error: "Unable to delete draft. Please try again." }, { status: 500 });
  }
}
