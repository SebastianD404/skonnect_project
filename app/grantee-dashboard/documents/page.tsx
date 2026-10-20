import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import GranteeDocumentsClient from "./GranteeDocumentsClient";
import { isGranteeProfileComplete } from "@/lib/grantee-profile";
import { getAcademicTermScheduleState } from "@/lib/academic-term-schedule";
import type { SubmissionStatus } from "@prisma/client";

export default async function GranteeDocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await prisma.user.findFirst({
    where: {
      OR: [{ authId: user.id }, { email: user.email ?? "" }],
    },
    include: {
      grantee: true,
    },
  });

  if (appUser && appUser.authId !== user.id) {
    try {
      await prisma.user.update({
        where: { id: appUser.id },
        data: { authId: user.id },
      });
    } catch {
      // Ignore relink failures and continue with fetched account data.
    }
  }

  if (!appUser || appUser.role !== "GRANTEE") {
    redirect("/login");
  }

  let submissions: Array<{
    id: string;
    semester: string;
    status: SubmissionStatus;
    coeStatus: SubmissionStatus;
    gradesStatus: SubmissionStatus;
    ocrStatus: "OCR_PENDING" | "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED" | null;
    reviewNotes: string | null;
    flaggedFields: string[];
    resubmittedFields: string[];
    submittedAt: Date;
    reviewedAt: Date | null;
    gradeFileUrl: string;
    coeFileUrl: string;
  }> = [];

  if (appUser.grantee?.id) {
    try {
      const raw = await prisma.submission.findMany({
        where: { granteeId: appUser.grantee.id },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          semester: true,
          status: true,
          coeStatus: true,
          gradesStatus: true,
          ocrStatus: true,
          reviewNotes: true,
          flaggedFields: true,
          resubmittedFields: true,
          submittedAt: true,
          reviewedAt: true,
          gradeFileUrl: true,
          coeFileUrl: true,
        },
      });

      submissions = raw;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/flaggedFields|resubmittedFields|ocrStatus|does not exist/i.test(message)) {
        throw error;
      }

      const fallback = await prisma.submission.findMany({
        where: { granteeId: appUser.grantee.id },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          semester: true,
          status: true,
          coeStatus: true,
          gradesStatus: true,
          reviewNotes: true,
          submittedAt: true,
          reviewedAt: true,
          gradeFileUrl: true,
          coeFileUrl: true,
        },
      });

      submissions = fallback.map((item) => ({
        ...item,
        ocrStatus: null,
        flaggedFields: [],
        resubmittedFields: [],
      }));
    }
  }

  
  const serialized = submissions.map((submission) => ({
    id: submission.id,
    semester: submission.semester,
    status: submission.status,
    coeStatus: submission.coeStatus,
    gradesStatus: submission.gradesStatus,
    ocrStatus: submission.ocrStatus,
    reviewNotes: submission.reviewNotes,
    flaggedFields: submission.flaggedFields,
    resubmittedFields: submission.resubmittedFields,
    submittedAt: submission.submittedAt.toISOString(),
    reviewedAt: submission.reviewedAt ? submission.reviewedAt.toISOString() : null,
    gradeFileUrl: submission.gradeFileUrl,
    coeFileUrl: submission.coeFileUrl,
  }));

  const canSubmit = isGranteeProfileComplete(appUser.grantee);
  const { window: academicTermWindow } = await getAcademicTermScheduleState();

  return (
    <main className="px-4 pb-20 pt-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <GranteeDocumentsClient
          key={`${academicTermWindow.status}:${academicTermWindow.semester ?? "none"}`}
          submissions={serialized}
          canSubmit={canSubmit}
          academicTermWindow={academicTermWindow}
        />
      </div>
    </main>
  );
}
