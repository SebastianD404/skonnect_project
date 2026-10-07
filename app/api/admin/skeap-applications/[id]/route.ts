import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { createClient } from "@/lib/supabase/server";
import { mapInquiryToApplication, SKEAP_APPLICATION_SELECT } from "@/lib/skeap-applications";
import { normalizeUploadedFiles, SKEAP_UPLOAD_ORDER } from "@/lib/skeap-upload";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const appUser = await ensureProfile(user);
    if (appUser?.role !== Role.SK_OFFICIAL && appUser?.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const inquiry = await prisma.inquiry.findFirst({
      where: {
        id,
        subject: { contains: "SKEAP application", mode: "insensitive" },
      },
      select: SKEAP_APPLICATION_SELECT,
    });
    if (!inquiry) return NextResponse.json({ error: "Application not found." }, { status: 404 });

    const application = mapInquiryToApplication(inquiry);
    return NextResponse.json({
      profile: {
        applicantName: application.applicantName,
        applicantEmail: application.applicantEmail,
        applicantPhoneNumber: application.applicantPhoneNumber,
        school: normalizeSkeapSchoolName(application.school),
        yearLevel: application.yearLevel,
      },
    });
  } catch (error) {
    console.error("Failed to refresh SKEAP applicant profile:", error);
    return NextResponse.json({ error: "Failed to refresh applicant profile." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const appUser = await ensureProfile(user);
    if (appUser?.role !== Role.SK_OFFICIAL && appUser?.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid verification update." }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const documentKey = payload.documentKey;
    const fileUrl = payload.fileUrl;
    const verified = payload.verified;
    const adminRemark = payload.adminRemark;
    if (
      typeof documentKey !== "string" ||
      !SKEAP_UPLOAD_ORDER.includes(documentKey as (typeof SKEAP_UPLOAD_ORDER)[number]) ||
      typeof fileUrl !== "string" ||
      !fileUrl.trim() ||
      (verified !== undefined && typeof verified !== "boolean") ||
      (adminRemark !== undefined && typeof adminRemark !== "string") ||
      (verified === undefined && adminRemark === undefined)
    ) {
      return NextResponse.json({ error: "Provide a valid document key, file URL, and verification state or private remark." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const inquiry = await tx.inquiry.findFirst({
        where: {
          id,
          subject: { contains: "SKEAP application", mode: "insensitive" },
        },
        select: {
          application: {
            select: {
              id: true,
              uploadedFiles: true,
            },
          },
        },
      });
      const application = inquiry?.application;
      if (!application) return { status: 404 as const };

      const uploadedFiles = normalizeUploadedFiles(application.uploadedFiles);
      const upload = uploadedFiles?.[documentKey];
      if (!uploadedFiles || !upload) return { status: 404 as const };
      if (upload.url !== fileUrl) return { status: 409 as const };

      uploadedFiles[documentKey] = {
        ...upload,
        ...(typeof verified === "boolean" ? { verified } : {}),
        ...(typeof adminRemark === "string" ? { adminRemark } : {}),
      };
      await tx.skeapApplication.update({
        where: { id: application.id },
        data: { uploadedFiles: uploadedFiles as Prisma.InputJsonValue },
      });

      return { status: 200 as const, verified: uploadedFiles[documentKey].verified, adminRemark: uploadedFiles[documentKey].adminRemark };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.status === 404) {
      return NextResponse.json({ error: "The uploaded document was not found." }, { status: 404 });
    }
    if (result.status === 409) {
      return NextResponse.json({ error: "This document has changed. Refresh the application and try again." }, { status: 409 });
    }

    return NextResponse.json({ verified: result.verified, adminRemark: result.adminRemark });
  } catch (error) {
    console.error("Failed to update SKEAP document verification:", error);
    return NextResponse.json({ error: "Failed to update document verification." }, { status: 500 });
  }
}
