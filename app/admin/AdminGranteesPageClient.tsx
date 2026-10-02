"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminSearch } from "./AdminSearchContext";
import AdminExportButton from "./AdminExportButton";
import { GranteeStatusTable, type GranteeTableRow } from "./grantees/GranteeStatusTable";
import type { SerializableSkeapApplicationFormPayload } from "./grantees/[id]/GranteeDossierView";
import SkeapApplicationFormModal from "@/components/SkeapApplicationFormModal";

interface AdminGranteesPageClientProps {
  grantees: GranteeTableRow[];
  page: number;
  pageSize: number;
  totalCount: number;
}

interface SelectedApplicationState {
  application: SerializableSkeapApplicationFormPayload | null;
  downloadHref?: string;
}

export default function AdminGranteesPageClient({
  grantees,
  page,
  pageSize,
  totalCount,
}: AdminGranteesPageClientProps) {
  const { searchQuery } = useAdminSearch();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, startTransition] = useTransition();
  useEffect(() => {
    const nextQuery = searchQuery.trim();
    if ((searchParams.get("q") ?? "") === nextQuery) return;

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextQuery) params.set("q", nextQuery);
      else params.delete("q");
      params.set("page", "1");
      const queryString = params.toString();
      startTransition(() => {
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [pathname, router, searchParams, searchQuery, startTransition]);
  const exportParams = new URLSearchParams();
  const status = searchParams.get("status");
  if (status) exportParams.set("status", status);
  if (searchQuery.trim()) exportParams.set("q", searchQuery.trim());
  const exportHref = `/api/admin/grantees/export${exportParams.size ? `?${exportParams.toString()}` : ""}`;
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
      <div className="flex w-full flex-col gap-6 pb-12">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Grantee Status</span>
            <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Track scholar progress</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
              See the latest status, academic average, and enrollment details for every approved grantee.
            </p>
          </div>
          <AdminExportButton
            href={exportHref}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
            iconClassName="h-4 w-4 text-slate-400"
          />
        </header>

        <GranteeStatusTable
          grantees={grantees}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          isLoading={isLoading}
          startNavigation={(callback) => startTransition(callback)}
          onViewApplication={handleViewApplication}
          onDelete={handleDeleteRequest}
        />
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
