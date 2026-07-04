"use client";

import { useState } from "react";
import SkeapApplicationFormModal from "@/components/SkeapApplicationFormModal";
import { Eye } from "lucide-react";

export type SerializableSkeapApplicationFormPayload = {
  currentCourse?: string;
  yearLevel?: string;
  gwa?: number | null;
  applicantName?: string;
  permanentAddress?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  age?: number;
  civilStatus?: string;
  gender?: string;
  fathersName?: string;
  fathersOccupation?: string;
  fathersContact?: string;
  mothersMaidenName?: string;
  mothersOccupation?: string;
  mothersContact?: string;
  contactNumber?: string;
  emailAddress?: string;
  photoFileUrl?: string;
  uploadedFiles?: unknown;
};

interface SkeapApplicationReviewClientProps {
  application: SerializableSkeapApplicationFormPayload | null;
  downloadHref?: string;
}

export default function SkeapApplicationReviewClient({ application, downloadHref }: SkeapApplicationReviewClientProps) {
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  return (
    <>
      <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">SKEAP application</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">Application form</h3>
            <p className="mt-1 text-sm text-slate-600">
              View the applicant’s submitted form and compare it with enrollment records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowApplicationForm(true)}
            disabled={!application}
            className="inline-flex items-center gap-2 rounded-full bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0D2E47] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
          >
            <Eye className="h-4 w-4" />
            View application form
          </button>
        </div>

        {!application ? (
          <div className="mt-6 rounded-3xl bg-white p-5 text-sm text-slate-600">
            No SKEAP application form was found for this grantee.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-white p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Applicant</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{application.applicantName ?? application.emailAddress ?? "Unknown"}</p>
            </div>
            <div className="rounded-3xl bg-white p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Course / year</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{application.currentCourse ?? "—"}</p>
              <p className="text-sm text-slate-500">{application.yearLevel ?? "—"}</p>
            </div>
          </div>
        )}
      </div>

      <SkeapApplicationFormModal
        isOpen={showApplicationForm}
        onClose={() => setShowApplicationForm(false)}
        application={application ?? undefined}
        downloadHref={downloadHref}
      />
    </>
  );
}
