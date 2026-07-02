import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import ApplicationReviewClient from "./ApplicationReviewClient";

type Props = { params: Promise<{ id?: string }> };

type ReviewMessage = {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
  attachments?: {
    fileId: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    adminRemark: string;
  }[];
};

export default async function ApplicationPage({ params }: Props) {
  const { id } = await params;
  if (!id) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentUserId: string | null = null;
  if (user) {
    const appUser = await ensureProfile(user);
    if (appUser) currentUserId = appUser.id;
  }

  const application = await prisma.inquiry.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      message: true,
      response: true,
      isResolved: true,
      createdAt: true,
      reviewThread: true,
      reviewStatus: true,
      resubmittedAt: true,
      lastUpdatedBy: true,
    },
  });

  if (!application) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-900">Application not found</h1>
        <p className="mt-3 text-sm text-slate-600">We could not find this application record.</p>
        <Link href="/programs" className="mt-5 inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
          Back to programs
        </Link>
      </div>
    );
  }

  if (!currentUserId || application.userId !== currentUserId) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-900">Not authorized</h1>
        <p className="mt-3 text-sm text-slate-600">You do not have permission to view this application.</p>
        <Link href="/programs" className="mt-5 inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
          Back to programs
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <ApplicationReviewClient
          application={{
            id: application.id,
            message: application.message,
            response: application.response,
            isResolved: application.isResolved,
            createdAt: application.createdAt.toISOString(),
            reviewThread: Array.isArray(application.reviewThread) ? (application.reviewThread as ReviewMessage[]) : [],
            reviewStatus: application.reviewStatus ?? "Pending review",
            resubmittedAt: application.resubmittedAt?.toISOString() ?? null,
            lastUpdatedBy: application.lastUpdatedBy,
          }}
        />
      </div>
    </div>
  );
}
