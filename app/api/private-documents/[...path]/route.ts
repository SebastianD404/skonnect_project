import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { ensureProfile } from "@/lib/auth";
import { downloadPrivateDocument } from "@/lib/private-documents";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_CONTENT_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  if (
    path.length < 3 ||
    !["kk-verification", "skeap-applications"].includes(path[0]) ||
    path.some((part) => !part || part === "." || part === ".." || /[\\/]/.test(part))
  ) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const appUser = await ensureProfile(user);
  if (!appUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const activeProfile = await prisma.user.findUnique({
    where: { id: appUser.id },
    select: { isActive: true },
  });
  if (!activeProfile?.isActive) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isOwner = path[1] === user.id;
  const isReviewer = appUser.role === Role.SK_OFFICIAL || appUser.role === Role.SUPER_ADMIN;
  if (!isOwner && !isReviewer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let data: Blob;
  try {
    data = await downloadPrivateDocument(path.join("/"));
  } catch (error) {
    console.error("Private document download failed:", error);
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const contentType = ALLOWED_CONTENT_TYPES.has(data.type)
    ? data.type
    : "application/octet-stream";
  return new NextResponse(new Uint8Array(await data.arrayBuffer()), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
