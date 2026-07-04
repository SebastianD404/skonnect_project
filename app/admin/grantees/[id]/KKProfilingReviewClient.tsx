"use client";

import { useState } from "react";
import { AdminKKProfilingFormView } from "@/app/admin/kk-profiling/AdminKKProfilingFormView";
import type { KKProfilingRegistration } from "@/app/admin/kk-profiling/types";
import { Eye } from "lucide-react";

export type SerializableKKProfilingRegistration = Omit<KKProfilingRegistration, "birthDate" | "submittedAt"> & {
  birthDate: string;
  submittedAt: string;
};

interface KKProfilingReviewClientProps {
  registration: SerializableKKProfilingRegistration | null;
}

export default function KKProfilingReviewClient({ registration }: KKProfilingReviewClientProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (!registration) {
    return (
      <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-500">
        No KK Profiling submission found for this grantee.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-3xl bg-slate-50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">KK Profiling record</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Completed</p>
            <p className="text-sm text-slate-500">Submitted {new Date(registration.submittedAt).toLocaleDateString()}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0D2E47]"
          >
            <Eye className="h-4 w-4" />
            View KK Profile
          </button>
        </div>
      </div>

      {showDetails && (
        <AdminKKProfilingFormView registration={registration} onClose={() => setShowDetails(false)} />
      )}
    </>
  );
}
