import { GranteeStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { hasGranteeColumn, prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  getPrivateDocumentPath,
  PRIVATE_DOCUMENT_BUCKET,
  uploadPrivateDocument,
  removePrivateDocument,
} from "@/lib/private-documents";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  GRADE_REPORT_MIME_TYPES,
  hasGradeReportSignature,
} from "@/lib/ocr/grade-report-file";
import {
  MAX_SKEAP_UPLOAD_SIZE_BYTES,
  SKEAP_UPLOAD_TOO_LARGE_MESSAGE,
} from "@/lib/skeap-upload";

function getMimeType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "jpg" || extension === "jpeg" || extension === "jfif") {
    return "image/jpeg";
  }
  return "application/octet-stream";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUser = await prisma.user.findFirst({
    where: { authId: user.id, isActive: true, role: Role.GRANTEE },
    select: { id: true },
  });
  if (!appUser) {
    return NextResponse.json({ error: "Only active grantees can view exit clearance." }, { status: 403 });
  }

  const hasFileNameColumn = await hasGranteeColumn("exitClearanceFileName");
  const grantee = await prisma.grantee.findFirst({
    where: {
      userId: appUser.id,
      status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      exitClearanceUrl: true,
      ...(hasFileNameColumn ? { exitClearanceFileName: true } : {}),
      user: { select: { authId: true } },
    },
  });
  if (!grantee?.exitClearanceUrl) {
    return NextResponse.json({ error: "No exit-clearance document has been submitted." }, { status: 404 });
  }

  const objectPath =
    getPrivateDocumentPath(grantee.exitClearanceUrl) ??
    (grantee.exitClearanceUrl.startsWith("grantee-clearances/")
      ? grantee.exitClearanceUrl
      : null);
  const ownerPrefix = `grantee-clearances/${grantee.user.authId}/`;
  if (
    !objectPath ||
    !objectPath.startsWith(ownerPrefix) ||
    objectPath.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    console.error("Stored exit-clearance path is invalid or does not belong to the scholar.");
    return NextResponse.json(
      { error: "Unable to generate a secure preview link for this document." },
      { status: 500 },
    );
  }

  const { data, error } = await createAdminClient()
    .storage.from(PRIVATE_DOCUMENT_BUCKET)
    .createSignedUrl(objectPath, 60);
  if (error || !data?.signedUrl) {
    console.error(
      "Could not create an exit-clearance preview URL.",
      error ?? new Error("Supabase Storage returned no signed URL."),
    );
    return NextResponse.json(
      { error: "Unable to generate a secure preview link for this document." },
      { status: 500 },
    );
  }

  const fileName =
    "exitClearanceFileName" in grantee && grantee.exitClearanceFileName
      ? grantee.exitClearanceFileName
      : grantee.exitClearanceUrl.split("/").pop() || "Exit clearance";
  return NextResponse.json(
    { url: data.signedUrl, fileName, mimeType: getMimeType(fileName) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await prisma.user.findFirst({
      where: { authId: user.id, isActive: true },
      select: {
        id: true,
        role: true,
        fullName: true,
      },
    });
    if (!appUser || appUser.role !== Role.GRANTEE) {
      return NextResponse.json({ error: "Only active grantees can submit exit clearance." }, { status: 403 });
    }
    const grantee = await prisma.grantee.findFirst({
      where: {
        userId: appUser.id,
        status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        exitClearanceStatus: true,
        exitClearanceUrl: true,
      },
    });
    if (!grantee) {
      return NextResponse.json({ error: "No active Grantee record was found for this account." }, { status: 404 });
    }
    if (grantee.exitClearanceStatus === "CLEARED") {
      return NextResponse.json({ error: "Exit clearance has already been completed." }, { status: 409 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const note = String(formData.get("note") ?? "").trim();
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a School Exit Clearance, Certificate of Graduation, or Diploma file." }, { status: 400 });
    }
    if (note.length > 1000) {
      return NextResponse.json({ error: "The optional note must be 1,000 characters or fewer." }, { status: 400 });
    }

    const submittedContentType = file.type.toLowerCase();
    const isJfif = /\.jfif$/i.test(file.name);
    const contentType = submittedContentType === "image/jfif" || isJfif
      ? "image/jpeg"
      : submittedContentType;
    if (!GRADE_REPORT_MIME_TYPES.has(contentType) || file.size === 0) {
      return NextResponse.json(
        { error: "Upload a PDF, JPG, PNG, JFIF, or WEBP file." },
        { status: 400 }
      );
    }
    if (file.size > MAX_SKEAP_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: SKEAP_UPLOAD_TOO_LARGE_MESSAGE },
        { status: 400 }
      );
    }

    const uploadFile = contentType === file.type
      ? file
      : new File([file], file.name.replace(/\.jfif$/i, ".jpg"), {
          type: contentType,
          lastModified: file.lastModified,
        });
    const fileBytes = new Uint8Array(await uploadFile.arrayBuffer());
    if (!hasGradeReportSignature(fileBytes, contentType)) {
      return NextResponse.json({ error: "The uploaded file does not match its declared file type." }, { status: 400 });
    }

    let uploaded: Awaited<ReturnType<typeof uploadPrivateDocument>>;
    try {
      uploaded = await uploadPrivateDocument(user.id, uploadFile, "grantee-clearances", "exit-clearance");
    } catch (error) {
      console.error("[POST /api/grantee/exit-clearance]", error);
      return NextResponse.json(
        { error: "Secure file storage could not accept your clearance. Please try again or contact SK Admin." },
        { status: 503 },
      );
    }

    const uploadedPath = uploaded.path;
    try {
      const submittedAt = new Date();
      const [hasFileNameColumn, hasSubmittedAtColumn] = await Promise.all([
        hasGranteeColumn("exitClearanceFileName"),
        hasGranteeColumn("exitClearanceSubmittedAt"),
      ]);

      await prisma.$transaction(async (tx) => {
        const updated = await tx.grantee.updateMany({
          where: {
            id: grantee.id,
            status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
            exitClearanceStatus: { in: ["NONE", "SUBMITTED", "RETURNED"] },
            exitClearanceUrl: grantee.exitClearanceUrl,
          },
          data: {
            exitClearanceStatus: "SUBMITTED",
            exitClearanceUrl: uploaded.url,
            ...(hasFileNameColumn ? { exitClearanceFileName: file.name } : {}),
            ...(hasSubmittedAtColumn ? { exitClearanceSubmittedAt: submittedAt } : {}),
            schoolClearanceVerified: false,
            skClearanceVerified: false,
            graduationRemarks: note || null,
          },
        });
        if (updated.count !== 1) {
          throw new Error("EXIT_CLEARANCE_SUBMISSION_CONFLICT");
        }

        const sourceKey = `exit-clearance-submitted:${grantee.id}`;
        const href = `/admin/grantees?search=${encodeURIComponent(appUser.fullName)}&graduateId=${encodeURIComponent(grantee.id)}`;
        await tx.adminNotification.upsert({
          where: { sourceKey },
          create: {
            sourceKey,
            title: "Exit Clearance Submitted",
            message: `${appUser.fullName} uploaded their Exit Clearance for graduation verification.`,
            type: "EXIT_CLEARANCE_SUBMITTED",
            href,
          },
          update: {
            title: "Exit Clearance Submitted",
            message: `${appUser.fullName} uploaded their Exit Clearance for graduation verification.`,
            href,
          },
        });
      });

      revalidatePath("/admin/exit-clearances");
      revalidatePath("/admin/grantees");
      revalidatePath("/admin/grantees/records");

      return NextResponse.json({
        success: true,
        exitClearanceStatus: "SUBMITTED",
        exitClearanceUrl: uploaded.url,
        exitClearanceFileName: file.name,
        exitClearanceSubmittedAt: submittedAt.toISOString(),
      });
    } catch (error) {
      if (uploadedPath) {
        try {
          await removePrivateDocument(uploadedPath);
        } catch (cleanupError) {
          console.error("Could not remove an uncommitted exit-clearance upload:", cleanupError);
        }
      }
      if (error instanceof Error && error.message === "EXIT_CLEARANCE_SUBMISSION_CONFLICT") {
        return NextResponse.json({ error: "Your clearance changed while this upload was processing. Refresh and try again." }, { status: 409 });
      }
      console.error("[POST /api/grantee/exit-clearance]", error);
      return NextResponse.json(
        { error: "Your file was uploaded, but we couldn't save the submission. Please try again." },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[POST /api/grantee/exit-clearance]", error);
    return NextResponse.json(
      { error: "We couldn't process your exit-clearance submission. Please try again." },
      { status: 500 },
    );
  }
}
