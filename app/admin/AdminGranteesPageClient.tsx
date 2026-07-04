"use client";

import { useState } from "react";
import { GranteeStatusTable, type GranteeTableRow } from "./grantees/GranteeStatusTable";
import DashboardHeaderWrapper from "./DashboardHeaderWrapper";
import { SerializableSkeapApplicationFormPayload } from "./grantees/[id]/SkeapApplicationReviewClient";
import SkeapApplicationFormModal from "@/components/SkeapApplicationFormModal";
import { Check, Clock, Users } from "lucide-react";

interface StatItem {
  label: string;
  value: string;
  sub: string;
  delta: string;
  up: boolean;
  iconName: "Users" | "CalendarDays" | "Inbox" | "Check";
}

interface AdminGranteesPageClientProps {
  dateLabel: string;
  openInquiryCount: number;
  pendingSubmissionCount: number;
  stats: StatItem[];
  statsByPeriod?: Record<"Today" | "Week" | "Month" | "Quarter", StatItem[]>;
  grantees: GranteeTableRow[];
}

interface SelectedApplicationState {
  application: SerializableSkeapApplicationFormPayload | null;
  downloadHref?: string;
}

export default function AdminGranteesPageClient({
  dateLabel,
  openInquiryCount,
  pendingSubmissionCount,
  stats,
  statsByPeriod,
  grantees,
}: AdminGranteesPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<SelectedApplicationState | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<GranteeTableRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleViewApplication = (grantee: GranteeTableRow) => {
    if (!grantee.application) return;
    setSelectedApplication({
      application: grantee.application,
      downloadHref: grantee.applicationDownloadHref,
    });
  };

  const closeApplicationModal = () => setSelectedApplication(null);

  const handleDeleteRequest = (grantee: GranteeTableRow) => {
    setDeleteCandidate(grantee);
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    setDeleteCandidate(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/admin/grantees/${deleteCandidate.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete grantee");
      }

      window.location.reload();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete grantee");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DashboardHeaderWrapper
        dateLabel={dateLabel}
        openInquiryCount={openInquiryCount}
        pendingSubmissionCount={pendingSubmissionCount}
        stats={stats}
        statsByPeriod={statsByPeriod}
        onSearch={setSearchQuery}
      />

      <div className="flex-1 py-8">
        <div className="px-8 space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">Grantee status</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Track scholar progress</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  See the latest status, academic average, and enrollment details for every approved grantee.
                </p>
              </div>
            </div>
          </div>

          <GranteeStatusTable
            grantees={grantees}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onViewApplication={handleViewApplication}
            onDelete={handleDeleteRequest}
          />
        </div>
      </div>
      <SkeapApplicationFormModal
        isOpen={Boolean(selectedApplication?.application)}
        onClose={closeApplicationModal}
        application={selectedApplication?.application ?? undefined}
        downloadHref={selectedApplication?.downloadHref}
      />
      {deleteCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Delete grantee</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Are you sure you want to delete {deleteCandidate.fullName}? This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close delete confirmation"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            {deleteError ? (
              <div className="mt-4 rounded-3xl bg-rose-50 p-4 text-sm text-rose-700">
                {deleteError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="inline-flex justify-center rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete grantee"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
