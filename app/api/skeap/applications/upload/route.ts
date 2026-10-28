import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { isSkeapTestAccount } from "@/lib/skeap-test-access";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getSupportedSkeapDocumentType } from "@/lib/skeap-upload";
import { getKKProfilingReviewStatus } from "@/lib/kk-profiling-review";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: "User profile not found" }, { status: 401 });
    }

    if (!isSkeapTestAccount(user.email)) {
      const profile = await prisma.user.findUnique({
        where: { id: appUser.id },
        select: {
          kkProfileId: true,
          kkProfile: { select: { isVerified: true } },
        },
      });

      if (!profile?.kkProfileId) {
        return NextResponse.json({ error: "You must complete KK profiling first." }, { status: 403 });
      }

      const latestRegistration = await prisma.profilingRegistration.findFirst({
        where: { userId: appUser.id },
        orderBy: { submittedAt: "desc" },
        select: { reviewStatus: true },
      });

      const reviewStatus = getKKProfilingReviewStatus(
        latestRegistration?.reviewStatus,
        profile.kkProfile?.isVerified ?? false,
      );
      if (reviewStatus !== "Approved") {
        return NextResponse.json(
          { error: "Your KK profiling registration must be approved before you can apply for SKEAP." },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const contentType = getSupportedSkeapDocumentType(file);
    if (!contentType) {
      return NextResponse.json(
        { error: "Only PDF, JPG, PNG, and WebP files are allowed." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size must not exceed 15MB" }, { status: 400 });
    }

    const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "upload";
    const filePath = `skeap-applications/${user.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("public image")
      .upload(filePath, await file.arrayBuffer(), {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from("public image").getPublicUrl(filePath);
    const publicUrl = publicUrlData.publicUrl;
    if (!publicUrl) {
      return NextResponse.json({ error: "Failed to generate file URL" }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: publicUrl, path: filePath });
  } catch (error) {
    console.error("SKEAP applicant upload failed:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
