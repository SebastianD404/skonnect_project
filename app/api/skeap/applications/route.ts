import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeUploadRequirement, normalizeUploadedFiles, SKEAP_UPLOAD_KEY } from "@/lib/skeap-upload";

function buildSkeapInquiryMessage(data: {
  applicantName?: string;
  schoolName?: string;
  currentCourse: string;
  yearLevel: string;
  emailAddress?: string;
  contactNumber?: string;
  enrollmentFileUrl: string;
  reportCardFileUrl: string;
  photoFileUrl?: string;
  uploadedFiles?: Array<{ url?: string; name?: string }> | Record<string, { url?: string; name?: string }>;
}) {
  const lines = [
    "Applicant submitted a SKEAP application.",
    `Applicant Name: ${data.applicantName || "Unknown"}`,
    `School / Institution: ${data.schoolName || "Unknown"}`,
    `Course: ${data.currentCourse}`,
    `Year Level: ${data.yearLevel}`,
  ];

  if (data.emailAddress) lines.push(`Email Address: ${data.emailAddress}`);
  if (data.contactNumber) lines.push(`Contact Number: ${data.contactNumber}`);

  const uploadedUrls = new Set<string>();
  const addUploadedUrl = (url?: string) => {
    const normalized = String(url || "").trim();
    if (normalized) uploadedUrls.add(normalized);
  };

  addUploadedUrl(data.enrollmentFileUrl);
  addUploadedUrl(data.reportCardFileUrl);
  addUploadedUrl(data.photoFileUrl);

  if (Array.isArray(data.uploadedFiles)) {
    data.uploadedFiles.forEach((file) => addUploadedUrl(file?.url));
  } else if (typeof data.uploadedFiles === "object" && data.uploadedFiles !== null) {
    Object.values(data.uploadedFiles).forEach((file) => addUploadedUrl((file as { url?: string })?.url));
  }

  if (uploadedUrls.size) {
    lines.push("", "Uploaded files:");
    uploadedUrls.forEach((url) => lines.push(url));
  }

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const authorization =
        request.headers.get("authorization") || request.headers.get("Authorization");

      if (authorization?.toLowerCase().startsWith("bearer ")) {
        const token = authorization.slice(7).trim();
        if (token) {
          const { data: session, error: sessionError } = await supabase.auth.setSession({
            access_token: token,
            refresh_token: "",
          });

          if (sessionError) {
            console.error("Supabase bearer token session failed:", sessionError.message);
          }

          user = session?.user ?? null;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "User profile not found" }, { status: 401 });
    }

    const body = await request.json();
    const schoolName = String(body.schoolName || "").trim();
    const currentCourse = String(body.currentCourse || "").trim();
    const yearLevel = String(body.yearLevel || "").trim();
    const enrollmentFileUrl = String(body.enrollmentFileUrl || "").trim();
    const reportCardFileUrl = String(body.reportCardFileUrl || "").trim();
    const gwaRaw = String(body.gwa || "").trim();
    const gwa = gwaRaw ? Number(gwaRaw) : null;
    const ageRaw = body.age == null ? "" : String(body.age).trim();
    const age = ageRaw ? Number(ageRaw) : undefined;

    const rawAppUploadedFiles = body.uploadedFiles ?? body.allUploadedFiles ?? body.documentUploads ?? null;
    const uploadedFiles = normalizeUploadedFiles(rawAppUploadedFiles);

    if (!schoolName || !currentCourse || !yearLevel || !enrollmentFileUrl || !reportCardFileUrl) {
      return NextResponse.json(
        { error: "School, course, year level, enrollment file, and report card file are required." },
        { status: 400 }
      );
    }

    if (gwa !== null && (Number.isNaN(gwa) || gwa < 0 || gwa > 100)) {
      return NextResponse.json({ error: "GWA must be between 0 and 100." }, { status: 400 });
    }

    if (age !== undefined && (Number.isNaN(age) || age < 0 || age > 120)) {
      return NextResponse.json({ error: "Age must be a valid number between 0 and 120." }, { status: 400 });
    }

    const kkProfile = await prisma.user.findUnique({
      where: { id: appUser.id },
      select: { kkProfileId: true },
    });

    if (!kkProfile?.kkProfileId) {
      return NextResponse.json({ error: "You must complete KK profiling first." }, { status: 403 });
    }

    // Check if the latest KK profiling registration is approved
    const latestRegistration = await prisma.profilingRegistration.findFirst({
      where: { userId: appUser.id },
      orderBy: { submittedAt: "desc" },
      select: { reviewStatus: true },
    });

    if (latestRegistration?.reviewStatus !== "Approved") {
      return NextResponse.json(
        { error: "Your KK profiling registration must be approved before you can apply for SKEAP." },
        { status: 403 }
      );
    }

    const requiredUploadKeys = [
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE,
      SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY,
      SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
      SKEAP_UPLOAD_KEY.GRADE_REPORT,
      SKEAP_UPLOAD_KEY.FAMILY_INCOME,
    ];

    if (!uploadedFiles) {
      console.error("Invalid uploadedFiles payload for SKEAP application", {
        userId: appUser.id,
        rawAppUploadedFiles,
      });
      return NextResponse.json(
        { error: "uploadedFiles must be a valid upload payload with one entry for each required document." },
        { status: 400 }
      );
    }

    const missingUploadKeys = requiredUploadKeys.filter(
      (key) => !uploadedFiles[key] || !uploadedFiles[key].url?.trim()
    );
    if (missingUploadKeys.length > 0) {
      return NextResponse.json(
        { error: `Missing required uploadedFiles keys: ${missingUploadKeys.join(", ")}` },
        { status: 400 }
      );
    }

    const createData = {
      userId: appUser.id,
      school: schoolName,
      currentCourse,
      yearLevel,
      gwa: gwa === null ? null : gwa,
      // Persist optional grades and timeline if provided by client
      grades: Array.isArray(body.grades) ? body.grades : undefined,
      timeline: body.timeline ? body.timeline : undefined,
      enrollmentFileUrl,
      reportCardFileUrl,
      applicantName: body.applicantName || undefined,
      permanentAddress: body.permanentAddress || undefined,
      dateOfBirth: body.dateOfBirth ? new Date(String(body.dateOfBirth)) : undefined,
      placeOfBirth: body.placeOfBirth || undefined,
      age: body.age ? Number(body.age) : undefined,
      civilStatus: body.civilStatus || undefined,
      gender: body.gender || undefined,
      fathersName: body.fathersName || undefined,
      fathersOccupation: body.fathersOccupation || undefined,
      fathersContact: body.fathersContact || undefined,
      mothersMaidenName: body.mothersMaidenName || undefined,
      mothersOccupation: body.mothersOccupation || undefined,
      contactNumber: body.contactNumber || undefined,
      emailAddress: body.emailAddress || undefined,
      uploadedFiles,
      photoFileUrl: body.photoFileUrl || undefined,
      // keep uploaded files as normalized JSON
    } as const;

    const created = await prisma.$transaction(async (tx) => {
      const application = await tx.skeapApplication.create({ data: createData, select: { id: true } });
      const inquiry = await tx.inquiry.create({
        data: {
          userId: appUser.id,
          applicationId: application.id,
          subject: "SKEAP application submitted",
          message: buildSkeapInquiryMessage({
            applicantName: createData.applicantName,
            schoolName: createData.school,
            currentCourse,
            yearLevel,
            emailAddress: createData.emailAddress,
            contactNumber: createData.contactNumber,
            enrollmentFileUrl,
            reportCardFileUrl,
            photoFileUrl: createData.photoFileUrl,
            uploadedFiles: createData.uploadedFiles,
          }),
          reviewStatus: "Pending review",
        },
        select: { id: true },
      });
      return { applicationId: application.id, inquiryId: inquiry.id };
    });

    return NextResponse.json({ success: true, applicationId: created.applicationId, inquiryId: created.inquiryId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit SKEAP application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
