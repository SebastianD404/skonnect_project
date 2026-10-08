import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  GRADE_REPORT_MIME_TYPES,
  hasGradeReportSignature,
  MAX_GRADE_REPORT_BYTES,
} from "@/lib/ocr/grade-report-file";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_COE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await prisma.user.findFirst({
      where: { OR: [{ authId: user.id }, { email: user.email ?? "" }] },
      select: { role: true, grantee: { select: { status: true } } },
    });
    if (!appUser || appUser.role !== "GRANTEE" || !appUser.grantee) {
      return NextResponse.json({ error: "Only grantee accounts can upload submission documents." }, { status: 403 });
    }
    if (appUser.grantee.status === "GRADUATED") {
      return NextResponse.json({ error: "Graduated scholar records are locked for statutory retention." }, { status: 409 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const kind = formData.get("kind");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (kind !== "grade" && kind !== "coe") {
      return NextResponse.json({ error: "Document kind must be grade or coe." }, { status: 400 });
    }

    const contentType = file.type.toLowerCase();
    const allowedTypes = kind === "grade" ? GRADE_REPORT_MIME_TYPES : ALLOWED_COE_TYPES;
    if (!allowedTypes.has(contentType)) {
      return NextResponse.json(
        {
          error:
            kind === "grade"
              ? "Grade reports must be PDF, JPG, PNG, or WEBP files."
              : "Only PDF, DOC/DOCX, PNG, JPG, and WEBP files are allowed.",
        },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_GRADE_REPORT_BYTES) {
      return NextResponse.json({ error: "File size must be less than 10MB" }, { status: 400 });
    }

    const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
    const filePath = `grantee-submissions/${user.id}/${Date.now()}-${safeName}`;
    const buffer = await file.arrayBuffer();
    if (
      kind === "grade" &&
      !hasGradeReportSignature(new Uint8Array(buffer), contentType)
    ) {
      return NextResponse.json(
        { error: "The uploaded file does not match its declared file type." },
        { status: 400 }
      );
    }

    const { error: uploadError } = await createAdminClient()
      .storage.from("grantee-submissions")
      .upload(filePath, buffer, {
        contentType: contentType === "image/jpg" ? "image/jpeg" : contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, path: filePath, kind });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
