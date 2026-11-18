import { GranteeStatus, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { uploadPrivateDocument, removePrivateDocument } from "@/lib/private-documents";
import {
  GRADE_REPORT_MIME_TYPES,
  hasGradeReportSignature,
} from "@/lib/ocr/grade-report-file";
import {
  MAX_SKEAP_UPLOAD_SIZE_BYTES,
  SKEAP_UPLOAD_TOO_LARGE_MESSAGE,
} from "@/lib/skeap-upload";

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
        grantee: {
          select: { id: true, status: true, exitClearanceStatus: true, exitClearanceUrl: true },
        },
      },
    });
    if (!appUser || appUser.role !== Role.GRANTEE || !appUser.grantee) {
      return NextResponse.json({ error: "Only active grantees can submit exit clearance." }, { status: 403 });
    }
    if (
      appUser.grantee.status !== GranteeStatus.ACTIVE &&
      appUser.grantee.status !== GranteeStatus.PROBATIONARY
    ) {
      return NextResponse.json({ error: "Exit clearance can only be submitted by an active scholar." }, { status: 409 });
    }
    if (appUser.grantee.exitClearanceStatus === "CLEARED") {
      return NextResponse.json({ error: "Exit clearance has already been completed." }, { status: 409 });
    }
    const grantee = appUser.grantee;

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

    let uploadedPath: string | null = null;
    try {
      const uploaded = await uploadPrivateDocument(user.id, uploadFile, "grantee-clearances", "exit-clearance");
      uploadedPath = uploaded.path;

      await prisma.$transaction(async (tx) => {
        const updated = await tx.grantee.updateMany({
          where: {
            id: grantee.id,
            status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
            exitClearanceStatus: { in: ["NONE", "SUBMITTED"] },
            exitClearanceUrl: grantee.exitClearanceUrl,
          },
          data: {
            exitClearanceStatus: "SUBMITTED",
            exitClearanceUrl: uploaded.url,
            schoolClearanceVerified: false,
            skClearanceVerified: false,
            graduationRemarks: note || null,
          },
        });
        if (updated.count !== 1) {
          throw new Error("EXIT_CLEARANCE_SUBMISSION_CONFLICT");
        }

        const sourceKey = `exit-clearance-submitted:${grantee.id}`;
        await tx.adminNotification.upsert({
          where: { sourceKey },
          create: {
            sourceKey,
            title: "Graduation Exit Clearance Submitted",
            message: `${appUser.fullName} uploaded their Exit Clearance for verification`,
            type: "EXIT_CLEARANCE_SUBMITTED",
          },
          update: {
            title: "Graduation Exit Clearance Submitted",
            message: `${appUser.fullName} uploaded their Exit Clearance for verification`,
          },
        });
      });

      return NextResponse.json({
        success: true,
        exitClearanceStatus: "SUBMITTED",
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
      console.error("Failed to submit grantee exit clearance:", error);
      return NextResponse.json({ error: "Unable to submit exit clearance right now." }, { status: 500 });
    }
  } catch (error) {
    console.error("Exit-clearance request failed.", error);
    return NextResponse.json({ error: "Unable to submit exit clearance right now." }, { status: 500 });
  }
}
