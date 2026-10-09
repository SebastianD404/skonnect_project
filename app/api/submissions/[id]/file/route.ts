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
    const isMetadataRequest = request.nextUrl.searchParams.get("metadata") === "true";
    const fileResponse = await fetch(signedUrl, {
      cache: "no-store",
      method: isMetadataRequest ? "HEAD" : "GET",
    });
    if (!fileResponse.ok) {
      const upstreamError = await fileResponse.text().catch(() => "");
      if (fileResponse.status === 404 || /object not found|not_found/i.test(upstreamError)) {
        return NextResponse.json(
          { code: "FILE_NOT_FOUND", error: "The uploaded document could not be found in storage." },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: "Could not retrieve submission file." }, { status: 502 });
    }
    if (!fileResponse.body) {
      if (isMetadataRequest && fileResponse.ok) {
        const extension = storedFile.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase() ?? "";
        return NextResponse.json({
          contentType: fileResponse.headers.get("content-type")?.split(";")[0].toLowerCase() ?? null,
          extension,
        });
      }
      return NextResponse.json({ error: "Could not retrieve submission file." }, { status: 502 });
    }

    const upstreamContentType = fileResponse.headers.get("content-type")?.split(";")[0].toLowerCase();
    if (isMetadataRequest) {
      const extension = storedFile.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase() ?? "";
      return NextResponse.json({ contentType: upstreamContentType ?? null, extension });
    }

    const inlineTypes = new Set(["application/pdf", "image/gif", "image/jpeg", "image/png", "image/webp"]);
    const isDownload = request.nextUrl.searchParams.get("download") === "true";
    if (!isDownload && (!upstreamContentType || !inlineTypes.has(upstreamContentType))) {
      return NextResponse.redirect(
        new URL(`/admin/submissions/${id}/document?kind=${kind}`, request.url)
      );
    }

    const extension = storedFile.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();
    const safeExtension = extension && /^[a-z0-9]{1,10}$/.test(extension) ? `.${extension}` : "";
    const headers = new Headers({
      "Content-Type": upstreamContentType || "application/octet-stream",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${kind === "coe" ? "certificate-of-enrollment" : "grade-report"}${safeExtension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    const contentLength = fileResponse.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new NextResponse(fileResponse.body, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/object not found|not found/i.test(message)) {
      return NextResponse.json(
        { code: "FILE_NOT_FOUND", error: "The uploaded document could not be found in storage." },
        { status: 404 }
      );
    }
    console.error("Could not access submission file:", error);
    return NextResponse.json({ error: "Could not access submission file." }, { status: 500 });
  }
}
