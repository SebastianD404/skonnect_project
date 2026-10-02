import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSkeapApplicationDocx } from "@/lib/docx/skeap-application-template";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    let application = await prisma.skeapApplication.findUnique({ where: { id } });
    let submittedAt: Date | undefined;
    if (!application) {
      const inquiry = await prisma.inquiry.findUnique({
        where: { id },
        select: { createdAt: true, application: true },
      });
      if (!inquiry?.application) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }
      application = inquiry.application;
      submittedAt = inquiry.createdAt;
    }

    const applicant = await prisma.user.findUnique({
      where: { id: application.userId },
      select: {
        fullName: true,
        email: true,
        phoneNumber: true,
        avatarUrl: true,
        kkProfile: {
          select: {
            firstName: true,
            lastName: true,
            purok: true,
            barangay: true,
            addressLine: true,
          },
        },
        profilingRegistrations: {
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: {
            registeredNationalVoter: true,
            sex: true,
            age: true,
            civilStatus: true,
            contactNumber: true,
          },
        },
      },
    });

    const output = await generateSkeapApplicationDocx(
      { ...application, submittedAt: submittedAt ?? application.submittedAt },
      {
        fullName: applicant?.fullName,
        firstName: applicant?.kkProfile?.firstName,
        lastName: applicant?.kkProfile?.lastName,
        email: applicant?.email,
        contactNumber: applicant?.profilingRegistrations[0]?.contactNumber ?? applicant?.phoneNumber,
        avatarUrl: applicant?.avatarUrl,
        gender: applicant?.profilingRegistrations[0]?.sex,
        age: applicant?.profilingRegistrations[0]?.age,
        civilStatus: applicant?.profilingRegistrations[0]?.civilStatus,
        registeredNationalVoter: applicant?.profilingRegistrations[0]?.registeredNationalVoter,
        address: applicant?.kkProfile
          ? {
              sitio: applicant.kkProfile.purok,
              barangay: applicant.kkProfile.barangay,
              addressLine: applicant.kkProfile.addressLine,
            }
          : undefined,
      }
    );

    return new NextResponse(Buffer.from(output), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="SKEAP Application Form (2).docx"',
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Failed to generate admin SKEAP application document:", error);
    const message = error instanceof Error ? error.message : "Failed to generate application document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
