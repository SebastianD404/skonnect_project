import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "User profile not found" }, { status: 401 });
    }

    const body = await request.json();
    const currentCourse = String(body.currentCourse || "").trim();
    const yearLevel = String(body.yearLevel || "").trim();
    const enrollmentFileUrl = String(body.enrollmentFileUrl || "").trim();
    const reportCardFileUrl = String(body.reportCardFileUrl || "").trim();
    const gwaRaw = String(body.gwa || "").trim();
    const gwa = gwaRaw ? Number(gwaRaw) : null;

    if (!currentCourse || !yearLevel || !enrollmentFileUrl || !reportCardFileUrl) {
      return NextResponse.json(
        { error: "Course, year level, enrollment file, and report card file are required." },
        { status: 400 }
      );
    }

    if (gwa !== null && (Number.isNaN(gwa) || gwa < 0 || gwa > 100)) {
      return NextResponse.json({ error: "GWA must be between 0 and 100." }, { status: 400 });
    }

    const kkProfile = await prisma.user.findUnique({
      where: { id: appUser.id },
      select: { kkProfileId: true },
    });

    if (!kkProfile?.kkProfileId) {
      return NextResponse.json({ error: "You must complete KK profiling first." }, { status: 403 });
    }

    // Build create data and cast to any to avoid strict Prisma input type mismatches
    const createData: any = {
      userId: appUser.id,
      currentCourse,
      yearLevel,
      gwa: gwa === null ? null : gwa,
      enrollmentFileUrl,
      reportCardFileUrl,
      applicantName: body.applicantName || undefined,
      permanentAddress: body.permanentAddress || undefined,
      dateOfBirth: body.dateOfBirth ? new Date(String(body.dateOfBirth)) : undefined,
      placeOfBirth: body.placeOfBirth || undefined,
      age: body.age ? Number(body.age) : undefined,
      civilStatus: body.civilStatus || undefined,
      fathersName: body.fathersName || undefined,
      fathersOccupation: body.fathersOccupation || undefined,
      fathersContact: body.fathersContact || undefined,
      mothersMaidenName: body.mothersMaidenName || undefined,
      mothersOccupation: body.mothersOccupation || undefined,
      contactNumber: body.contactNumber || undefined,
      emailAddress: body.emailAddress || undefined,
      uploadedFiles: body.allUploadedFiles ?? undefined,
      photoFileUrl: body.photoFileUrl || undefined,
    };

    const created = await prisma.skeapApplication.create({ data: createData, select: { id: true } });

    return NextResponse.json({ success: true, applicationId: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit SKEAP application";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
