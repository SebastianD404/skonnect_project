import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getApprovedKkProfileIdentity,
  hasCompleteKkIdentityDocuments,
} from "@/lib/kk-identity-documents";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Could not verify session for KK identity documents:", error);
    return NextResponse.json({ error: "Unable to verify your session." }, { status: 500 });
  }
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const appUser = await ensureProfile(authUser);
  if (!appUser) {
    return NextResponse.json({ error: "Account profile not found." }, { status: 404 });
  }
  if (appUser.kkStatus !== "APPROVED") {
    return NextResponse.json({ error: "Approved KK Profiling is required." }, { status: 403 });
  }

  const identity = await getApprovedKkProfileIdentity(appUser.id);
  if (!identity.registration) {
    return NextResponse.json({ error: "No approved KK Profiling documents were found." }, { status: 404 });
  }

  if (!hasCompleteKkIdentityDocuments(identity.documents)) {
    return NextResponse.json(
      { error: "Your approved KK Profile is missing one or more identity documents. Contact SK support." },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { documents: identity.documents },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
