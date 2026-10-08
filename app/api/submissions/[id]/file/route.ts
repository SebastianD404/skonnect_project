import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSignedSubmissionFileUrl } from "@/lib/ocr/storage";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "grade" && kind !== "coe") {
    return NextResponse.json({ error: "File kind must be grade or coe." }, { status: 400 });
  }

  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    select: {
      gradeFileUrl: true,
      coeFileUrl: true,
      grantee: { select: { user: { select: { authId: true } } } },
    },
  });
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const appUser = await ensureProfile(user);
  const isAdmin =
    appUser?.role === Role.SK_OFFICIAL || appUser?.role === Role.SUPER_ADMIN;
  if (!isAdmin && (appUser?.role !== Role.GRANTEE || submission.grantee.user.authId !== user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storedFile = kind === "grade" ? submission.gradeFileUrl : submission.coeFileUrl;
  if (!storedFile) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  try {
    const signedUrl = await createSignedSubmissionFileUrl(
      storedFile,
      submission.grantee.user.authId
    );
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not access submission file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
