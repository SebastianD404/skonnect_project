import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { removePrivateDocument, uploadPrivateDocument } from "@/lib/private-documents";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PHOTO_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("Could not verify session for KK profile photo update:", authError);
    return NextResponse.json({ error: "Unable to verify your session." }, { status: 500 });
  }
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const appUser = await ensureProfile(authUser);
  if (!appUser) {
    return NextResponse.json({ error: "Account profile not found." }, { status: 404 });
  }
  if (!appUser.isActive) {
    return NextResponse.json({ error: "Your account is inactive." }, { status: 403 });
  }
  if (appUser.kkStatus !== "APPROVED") {
    return NextResponse.json({ error: "Approved KK Profiling is required." }, { status: 403 });
  }

  const registration = await prisma.profilingRegistration.findFirst({
    where: {
      userId: appUser.id,
      reviewStatus: { equals: "Approved", mode: "insensitive" },
    },
    orderBy: { submittedAt: "desc" },
    select: { id: true },
  });
  if (!registration) {
    return NextResponse.json({ error: "No approved KK Profiling record was found." }, { status: 404 });
  }

  let photo: FormDataEntryValue | null;
  try {
    photo = (await request.formData()).get("photo");
  } catch (error) {
    console.error("Could not read uploaded KK profile photo:", error);
    return NextResponse.json({ error: "Unable to read the uploaded photo." }, { status: 400 });
  }

  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "Please choose a JPG or PNG photo." }, { status: 400 });
  }
  const extension = PHOTO_TYPES.get(photo.type);
  if (!extension) {
    return NextResponse.json({ error: "Photo must be a JPG or PNG image." }, { status: 400 });
  }
  if (photo.size === 0 || photo.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Photo must be no larger than 10MB." }, { status: 400 });
  }

  let privateDocumentPath: string | null = null;
  let avatarPath: string | null = null;
  try {
    const privateDocument = await uploadPrivateDocument(
      authUser.id,
      new File([photo], `latest-photo.${extension}`, { type: photo.type }),
      "kk-verification",
      "photo",
    );
    privateDocumentPath = privateDocument.path;

    avatarPath = `avatars/${authUser.id}/kk-profile-${Date.now()}-${randomUUID()}.${extension}`;
    const { error: avatarUploadError } = await supabase.storage
      .from("avatars")
      .upload(avatarPath, await photo.arrayBuffer(), {
        contentType: photo.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (avatarUploadError) throw avatarUploadError;

    await prisma.$transaction([
      prisma.profilingRegistration.update({
        where: { id: registration.id },
        data: { photoFileUrl: privateDocument.url },
      }),
      prisma.user.update({
        where: { id: appUser.id },
        data: { avatarUrl: avatarPath },
      }),
    ]);

    return NextResponse.json({
      photo: privateDocument.url,
      avatarUrl: avatarPath,
    });
  } catch (error) {
    console.error("Could not save updated KK profile photo:", error);
    if (privateDocumentPath) {
      try {
        await removePrivateDocument(privateDocumentPath);
      } catch (cleanupError) {
        console.error("Could not remove uncommitted KK photo document:", cleanupError);
      }
    }
    if (avatarPath) {
      const { error: cleanupError } = await supabase.storage.from("avatars").remove([avatarPath]);
      if (cleanupError) {
        console.error("Could not remove uncommitted profile avatar:", cleanupError);
      }
    }
    return NextResponse.json({ error: "Unable to save your updated photo. Please try again." }, { status: 500 });
  }
}
