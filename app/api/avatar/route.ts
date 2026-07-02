import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const profile = await ensureProfile(user);
    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("avatar");
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Build storage path
    const originalName = (file as any).name || `upload`;
    const fileExt = "webp";
    const fileName = `${Date.now()}-${originalName.toString().replace(/[^a-zA-Z0-9.\-]/g, "_")}.${fileExt}`;
    const path = `avatars/${user.id}/${fileName}`;

    // Convert uploaded file/blob to a Buffer
    let buffer: Buffer;
    try {
      if (typeof (file as any).arrayBuffer === "function") {
        const ab = await (file as any).arrayBuffer();
        buffer = Buffer.from(ab);
      } else if (Buffer.isBuffer(file)) {
        buffer = file as unknown as Buffer;
      } else if (file instanceof Uint8Array) {
        buffer = Buffer.from(file as Uint8Array);
      } else {
        buffer = Buffer.from(String(file));
      }
    } catch (e) {
      console.error("Failed to read uploaded avatar file:", e);
      return NextResponse.json({ error: "Failed to read uploaded file" }, { status: 500 });
    }

    // Try to resize using sharp, fall back to original buffer if it fails
    let uploadBuffer = buffer;
    try {
      let sharpLib: any = undefined;
      try {
        const imported = await import("sharp");
        sharpLib = imported?.default ?? imported;
      } catch (e) {
        sharpLib = undefined;
      }

      if (sharpLib) {
        uploadBuffer = await sharpLib(buffer).resize(512, 512, { fit: "cover" }).toFormat("webp").toBuffer();
      }
    } catch (e) {
      console.warn("Image processing failed, uploading original file instead:", e);
      uploadBuffer = buffer;
    }

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, uploadBuffer, { upsert: true, contentType: "image/webp" });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message ?? String(uploadError) }, { status: 500 });
    }

    // Store the storage path in DB
    try {
      await prisma.user.update({ where: { id: profile.id }, data: { avatarUrl: path } });
    } catch (e) {
      console.error("Prisma update avatarUrl failed:", e);
    }

    // Return a signed URL for immediate client use (7 days)
    try {
      const signed = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      const signedUrl = signed.data?.signedUrl || null;
      return NextResponse.json({ avatarUrl: signedUrl });
    } catch (e) {
      return NextResponse.json({ avatarUrl: path });
    }
  } catch (err: any) {
    console.error("Unexpected avatar POST error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const linkedUser = await ensureProfile(user);
  if (!linkedUser) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const profile = await prisma.user.findUnique({
    where: { id: linkedUser.id },
    select: { avatarUrl: true },
  });

  if (!profile || !profile.avatarUrl) {
    try {
      await prisma.user.update({ where: { id: linkedUser.id }, data: { avatarUrl: null } });
    } catch (e) {
      console.error("Prisma clear avatarUrl failed:", e);
    }
    return NextResponse.json({ ok: true });
  }

  const path = profile.avatarUrl;

  try {
    await supabase.storage.from("avatars").remove([path]);
  } catch (e) {
    console.error("Avatar delete error:", e);
  }

  try {
    await prisma.user.update({ where: { id: linkedUser.id }, data: { avatarUrl: null } });
  } catch (e) {
    console.error("Prisma clear avatarUrl failed:", e);
  }

  return NextResponse.json({ ok: true });
}