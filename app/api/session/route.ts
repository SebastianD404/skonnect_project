import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  const profile = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { fullName: true, email: true, role: true, avatarUrl: true },
  });
  // Prefer the avatar stored in our profile, but fall back to any avatar present
  // in the Supabase Auth user's metadata (e.g., OAuth provider avatar).
  const metadataAvatar = (user.user_metadata as any)?.avatar_url || (user.user_metadata as any)?.avatarUrl || null;
  const avatarPath = profile?.avatarUrl || metadataAvatar;

  if (avatarPath) {
    // If the avatar looks like a Supabase storage path (no protocol), try to
    // create a signed URL. Otherwise assume it's an external URL and return it.
    if (!avatarPath.startsWith("http://") && !avatarPath.startsWith("https://")) {
      try {
        const signed = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60 * 24 * 7);
        const signedUrl = signed.data?.signedUrl;
        return NextResponse.json({ user: { ...profile, avatarUrl: signedUrl || avatarPath } });
      } catch (e) {
        // fallback to raw path
        return NextResponse.json({ user: { ...profile, avatarUrl: avatarPath } });
      }
    }

    return NextResponse.json({ user: { ...profile, avatarUrl: avatarPath } });
  }

  return NextResponse.json({ user: profile || null });
}
