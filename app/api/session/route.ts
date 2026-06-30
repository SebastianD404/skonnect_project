import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null });
  }

  const profile = await ensureProfile(user);

  if (!profile) {
    return NextResponse.json({ user: null });
  }

  const metadataAvatar = (user.user_metadata as any)?.avatar_url || (user.user_metadata as any)?.avatarUrl || null;
  const avatarPath = profile.avatarUrl || metadataAvatar;

  if (avatarPath) {
    if (!avatarPath.startsWith("http://") && !avatarPath.startsWith("https://")) {
      try {
        const signed = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60 * 24 * 7);
        const signedUrl = signed.data?.signedUrl;
        return NextResponse.json({ user: { ...profile, avatarUrl: signedUrl || avatarPath } });
      } catch (e) {
        return NextResponse.json({ user: { ...profile, avatarUrl: avatarPath } });
      }
    }

    return NextResponse.json({ user: { ...profile, avatarUrl: avatarPath } });
  }

  return NextResponse.json({ user: profile });
}
