import { Role, SubmissionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { downloadPrivateDocument, getPrivateDocumentPath } from "@/lib/private-documents";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ applicationId: string }>;
};

function decodePath(parts: string[]) {
  try {
    const decoded = parts.map((part) => decodeURIComponent(part));
    if (decoded.some((part) => !part || part === "." || part === ".." || /[\\/]/.test(part))) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function getLegacyStorageObject(fileUrl: string, authUserId: string) {
  const configuredUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return null;

  let url: URL;
  try {
    url = new URL(fileUrl);
    if (url.origin !== new URL(configuredUrl).origin) return null;
  } catch {
    return null;
  }

  const prefix = "/storage/v1/object/";
  if (!url.pathname.startsWith(prefix)) return null;
  const [access, bucket, ...encodedPath] = url.pathname.slice(prefix.length).split("/");
  if (!["public", "sign", "authenticated"].includes(access ?? "")) return null;
  if (bucket !== "skeap-applications" && bucket !== "private-documents") return null;

  const path = decodePath(encodedPath);
  if (!path) return null;
  const isOwnedPrivateDocument =
    bucket === "private-documents" &&
    path.length >= 3 &&
    path[0] === "skeap-applications" &&
    path[1] === authUserId;
  const isOwnedLegacyDocument =
    bucket === "skeap-applications" &&
    path.length >= 2 &&
    path[0] === authUserId;
  if (!isOwnedPrivateDocument && !isOwnedLegacyDocument) return null;
  return { bucket, path: path.join("/") };
}

function getStoredPrivateDocumentPath(fileUrl: string, authUserId: string) {
  const pathFromApi = getPrivateDocumentPath(fileUrl.split(/[?#]/, 1)[0]);
  if (pathFromApi) return pathFromApi;

  let pathname = fileUrl;
  try {
    pathname = new URL(fileUrl).pathname;
  } catch {
    // Raw storage paths are supported for legacy records.
  }
  const pathFromApiUrl = getPrivateDocumentPath(pathname);
  if (pathFromApiUrl) return pathFromApiUrl;

  let encodedSegments = pathname.split(/[?#]/, 1)[0].replace(/^\/+/, "").split("/");
  if (encodedSegments[0] === "private-documents") {
    encodedSegments = encodedSegments.slice(1);
  }
  const segments = decodePath(encodedSegments);
  if (
    !segments ||
    segments.length < 3 ||
    segments[0] !== "skeap-applications" ||
    segments[1] !== authUserId
  ) {
    return null;
  }
  return segments.join("/");
}

function getDocumentContentType(contentType: string, storedFile: string) {
  const normalizedType = contentType.toLowerCase();
  if (["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(normalizedType)) {
    return normalizedType;
  }
  const extension = storedFile.split(/[?#]/, 1)[0].split("/").pop()?.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "jpg":
    case "jpeg":
    case "jfif":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

function getSafeFilename(baseName: string | null, storedFile: string) {
  const extension = storedFile
    .split(/[?#]/, 1)[0]
    .split("/")
    .pop()
    ?.split(".")
    .pop()
    ?.toLowerCase();
  const safeExtension = extension && /^[a-z0-9]{1,10}$/.test(extension) ? `.${extension}` : "";
  const safeBase = (baseName ?? "SKEAP-Document")
    .replace(/\.[a-z0-9]{1,10}$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 100);
  return `${safeBase || "SKEAP-Document"}${safeExtension}`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const appUser = await ensureProfile(user);
    if (!appUser || appUser.role !== Role.GRANTEE) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const kind = request.nextUrl.searchParams.get("kind");
    if (kind !== "grade" && kind !== "coe") {
      return NextResponse.json({ error: "Document kind must be grade or coe." }, { status: 400 });
    }

    const { applicationId } = await context.params;
    const application = await prisma.skeapApplication.findFirst({
      where: {
        id: applicationId,
        userId: appUser.id,
        status: SubmissionStatus.APPROVED,
      },
      select: {
        reportCardFileUrl: true,
        enrollmentFileUrl: true,
      },
    });
    if (!application) return NextResponse.json({ error: "Document not found." }, { status: 404 });

    const storedFile = kind === "grade"
      ? application.reportCardFileUrl
      : application.enrollmentFileUrl;
    if (!storedFile?.trim()) {
      return NextResponse.json({ error: "File not available." }, { status: 404 });
    }

    const download = request.nextUrl.searchParams.get("download") === "true";
    const requestedFilename = request.nextUrl.searchParams.get("filename");
    const filename = getSafeFilename(requestedFilename, storedFile);
    const privateDocumentPath = getStoredPrivateDocumentPath(storedFile, user.id);
    if (privateDocumentPath) {
      const expectedPrefix = `skeap-applications/${user.id}/`;
      if (!privateDocumentPath.startsWith(expectedPrefix)) {
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
      }

      const document = await downloadPrivateDocument(privateDocumentPath);
      return new NextResponse(new Uint8Array(await document.arrayBuffer()), {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
          "Content-Type": getDocumentContentType(document.type, storedFile),
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const legacyObject = getLegacyStorageObject(storedFile, user.id);
    if (legacyObject) {
      if (legacyObject.bucket === "private-documents") {
        const document = await downloadPrivateDocument(legacyObject.path);
        return new NextResponse(new Uint8Array(await document.arrayBuffer()), {
          headers: {
            "Cache-Control": "private, no-store",
            "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
            "Content-Type": getDocumentContentType(document.type, storedFile),
            "X-Content-Type-Options": "nosniff",
          },
        });
      }

      const { data, error } = await createAdminClient()
        .storage
        .from(legacyObject.bucket)
        .createSignedUrl(legacyObject.path, 5 * 60, {
          download: download ? filename : false,
        });
      if (error) throw error;
      if (!data.signedUrl) throw new Error("Could not create a secure document link.");
      return NextResponse.redirect(data.signedUrl, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    return NextResponse.json({ error: "File not available." }, { status: 404 });
  } catch (error) {
    console.error("Could not access academic journey document:", error);
    return NextResponse.json({ error: "Could not access document." }, { status: 500 });
  }
}
