import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = params?.id;
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.urls) || !Array.isArray(body.replacements) || typeof body.message !== "string") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const reviewThreadUpdate = await prisma.inquiry.findUnique({
    where: { id },
    select: { reviewThread: true },
  });

  const existingThread = Array.isArray(reviewThreadUpdate?.reviewThread) ? reviewThreadUpdate!.reviewThread : [];
  const newEntry = {
    id: crypto.randomUUID(),
    role: "applicant",
    createdAt: new Date().toISOString(),
    text: body.message,
    attachments: body.replacements.map((replacement: any) => ({
      fileId: replacement.fileUrl,
      fileName: replacement.fileName,
      fileUrl: replacement.fileUrl,
      fileType: replacement.fileType,
      adminRemark: "Applicant replacement upload",
    })),
  };

  const inquiry = await prisma.inquiry.update({
    where: { id },
    data: {
      isResolved: false,
      response: "Applicant resubmitted files for review.",
      reviewStatus: "Resubmitted",
      lastUpdatedBy: "applicant",
      resubmittedAt: new Date(),
      reviewThread: [...existingThread, newEntry],
    },
  });

  return NextResponse.json({ inquiry });
}
