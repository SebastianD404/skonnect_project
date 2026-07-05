import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClipboardList, FileText, User } from "lucide-react";
import SkeapApplicationReviewClient, {
  SerializableSkeapApplicationFormPayload,
} from "./SkeapApplicationReviewClient";

type Props = {
  params: Promise<{
    id?: string | string[];
  }>;
};

export default async function AdminGranteeDetailPage({ params }: Props) {
  const { id } = await params;
  const rawId = Array.isArray(id) ? id[0] : id;
  const granteeId = rawId?.startsWith("user-") ? rawId.slice(5) : rawId;

  if (!granteeId) {
    notFound();
  }

  const grantee = await prisma.grantee.findUnique({
    where: { id: granteeId },
    include: {
      user: true,
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 5,
      },
    },
  });

  if (!grantee) {
    notFound();
  }

  const applicationInquiry = await prisma.inquiry.findFirst({
    where: {
      userId: grantee.userId,
      subject: { contains: "SKEAP application", mode: "insensitive" },
      NOT: [{ reviewStatus: { contains: "cancel", mode: "insensitive" } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      user: {
        select: {
          email: true,
        },
      },
      application: {
        select: {
          currentCourse: true,
          yearLevel: true,
          gwa: true,
          applicantName: true,
          permanentAddress: true,
          dateOfBirth: true,
          placeOfBirth: true,
          age: true,
          civilStatus: true,
          gender: true,
          fathersName: true,
          fathersOccupation: true,
          fathersContact: true,
          mothersMaidenName: true,
          mothersOccupation: true,
          mothersContact: true,
          contactNumber: true,
          emailAddress: true,
          photoFileUrl: true,
          uploadedFiles: true,
        },
      },
    },
  });

  const serializedSkeapApplication: SerializableSkeapApplicationFormPayload | null =
    applicationInquiry?.application === null || applicationInquiry?.application === undefined
      ? null
      : {
          currentCourse: applicationInquiry.application.currentCourse ?? undefined,
          yearLevel: applicationInquiry.application.yearLevel ?? undefined,
          gwa: applicationInquiry.application.gwa ?? null,
          applicantName: applicationInquiry.application.applicantName ?? undefined,
          permanentAddress: applicationInquiry.application.permanentAddress ?? undefined,
          dateOfBirth: applicationInquiry.application.dateOfBirth?.toISOString() ?? undefined,
          placeOfBirth: applicationInquiry.application.placeOfBirth ?? undefined,
          age: applicationInquiry.application.age ?? undefined,
          civilStatus: applicationInquiry.application.civilStatus ?? undefined,
          gender: applicationInquiry.application.gender ?? undefined,
          fathersName: applicationInquiry.application.fathersName ?? undefined,
          fathersOccupation: applicationInquiry.application.fathersOccupation ?? undefined,
          fathersContact: applicationInquiry.application.fathersContact ?? undefined,
          mothersMaidenName: applicationInquiry.application.mothersMaidenName ?? undefined,
          mothersOccupation: applicationInquiry.application.mothersOccupation ?? undefined,
          mothersContact: applicationInquiry.application.mothersContact ?? undefined,
          contactNumber: applicationInquiry.application.contactNumber ?? undefined,
          emailAddress: applicationInquiry.application.emailAddress ?? applicationInquiry.user.email ?? undefined,
          photoFileUrl: applicationInquiry.application.photoFileUrl ?? undefined,
          uploadedFiles: applicationInquiry.application.uploadedFiles ?? undefined,
        };

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">Grantee details</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">{grantee.user.fullName}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">View the grantee’s profile data, enrollment status, and recent submission history.</p>
          </div>
          <Link
            href="/admin/grantees"
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Back to grantees
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-900 text-white">
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">KK Profiling</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Profile details</h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Email</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{grantee.user.email}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">School / year</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{grantee.school}</p>
              <p className="text-sm text-slate-500">{grantee.yearLevel}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Status</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{grantee.status}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Enrollment date</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{new Date(grantee.dateEnrolled).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Scholarship metrics</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">Academic summary</h3>
              </div>
              <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                GPA: {grantee.generalAverage !== null ? grantee.generalAverage.toFixed(2) : "—"}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
            <SkeapApplicationReviewClient
              application={serializedSkeapApplication}
              downloadHref={applicationInquiry ? `/api/admin/skeap-applications/${applicationInquiry.id}/download` : undefined}
            />
          </div>
        </section>

        <aside className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-900 text-white">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">SKEAP application</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Application status</h2>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Approval status</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{grantee.status}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Enrollment date</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{new Date(grantee.dateEnrolled).toLocaleDateString()}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Current school</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{grantee.school}</p>
            </div>
          </div>
        </aside>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">Recent submissions</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Recent semester files</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
            <FileText className="h-4 w-4" />
            latest 5
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {grantee.submissions.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">No submissions found for this grantee.</div>
          ) : (
            grantee.submissions.map((submission) => (
              <div key={submission.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{submission.semester}</p>
                    <p className="text-sm text-slate-500">{submission.status}</p>
                  </div>
                  <p className="text-sm text-slate-500">Submitted {new Date(submission.submittedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
