"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminSearch } from "./AdminSearchContext";
import AdminExportButton from "./AdminExportButton";
import { GranteeStatusTable, type GranteeTableRow } from "./grantees/GranteeStatusTable";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import RevokeGranteeModal from "./submissions/RevokeGranteeModal";

type RevocationNotificationStatus = "NOT_REQUIRED" | "PENDING" | "SENDING" | "FAILED" | "SENT";

function isRevocationNotificationStatus(value: unknown): value is RevocationNotificationStatus {
  return value === "NOT_REQUIRED" || value === "PENDING" || value === "SENDING" || value === "FAILED" || value === "SENT";
}

interface AdminGranteesPageClientProps {
  grantees: GranteeTableRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  query: string;
}

export default function AdminGranteesPageClient({
  grantees,
  page,
  pageSize,
  totalCount,
  query,
}: AdminGranteesPageClientProps) {
  const { searchQuery, setSearchQuery } = useAdminSearch();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, startTransition] = useTransition();
  const initializedRouteQuery = useRef(false);
  const lastRouteQuery = useRef(query);

  useEffect(() => {
    if (!initializedRouteQuery.current || lastRouteQuery.current !== query) {
      initializedRouteQuery.current = true;
      lastRouteQuery.current = query;
      if (searchQuery.trim() !== query) {
        setSearchQuery(query);
        return;
      }
    }

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
  }, [pathname, query, router, searchParams, searchQuery, setSearchQuery, startTransition]);
  const exportParams = new URLSearchParams();
  if (searchQuery.trim()) exportParams.set("q", searchQuery.trim());
  const exportHref = `/api/admin/grantees/export${exportParams.size ? `?${exportParams.toString()}` : ""}`;
  const isSearchLoading = searchQuery.trim() !== query;
  const [scholarshipCandidate, setScholarshipCandidate] = useState<GranteeTableRow | null>(null);
  const [isRevokingGrantee, setIsRevokingGrantee] = useState(false);
  const [revocationError, setRevocationError] = useState<string | null>(null);
  const [revocationSaved, setRevocationSaved] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<RevocationNotificationStatus | null>(null);
  const [archiveRefreshFailed, setArchiveRefreshFailed] = useState(false);
  const [revocationNotice, setRevocationNotice] = useState<string | null>(null);
  const [revocationSuccess, setRevocationSuccess] = useState<string | null>(null);

  const handleRevokeGranteeRequest = (grantee: GranteeTableRow) => {
    setScholarshipCandidate(grantee);
    setRevocationSuccess(null);
    setRevocationError(null);
    setRevocationNotice(null);
    setRevocationSaved(false);
    setNotificationStatus(null);
    setArchiveRefreshFailed(false);
  };

  const closeRevokeGranteeModal = () => {
    setScholarshipCandidate(null);
    setRevocationError(null);
    setRevocationNotice(null);
    setRevocationSaved(false);
    setNotificationStatus(null);
    setArchiveRefreshFailed(false);
  };

  const confirmRevokeGrantee = async (
    granteeId: string,
    reason: string,
    additionalNotes: string,
  ) => {
    if (!scholarshipCandidate || scholarshipCandidate.id !== granteeId) return;
    setIsRevokingGrantee(true);
    setRevocationError(null);
    setRevocationNotice(null);

    try {
      const response = await fetch(`/api/admin/grantees/${granteeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVOKED", reason, additionalNotes }),
      });

      const data = await response.json().catch(() => ({}));
      if (data?.revocationStatus === "REVOKED") {
        const nextNotificationStatus = isRevocationNotificationStatus(data.notificationStatus)
          ? data.notificationStatus
          : "SENDING";
        const nextArchiveRefreshFailed = data.archiveRefreshStatus === "FAILED";
        const complete =
          (nextNotificationStatus === "SENT" || nextNotificationStatus === "NOT_REQUIRED") &&
          !nextArchiveRefreshFailed;

        setRevocationSaved(true);
        setNotificationStatus(nextNotificationStatus);
        setArchiveRefreshFailed(nextArchiveRefreshFailed);
        setRevocationNotice(typeof data.error === "string" ? data.error : null);
        router.refresh();

        if (complete) {
          setRevocationSuccess(`${scholarshipCandidate.fullName} was revoked and moved to Revoked Grantees.`);
          closeRevokeGranteeModal();
        }
        return;
      }
      if (!response.ok) {
        throw new Error(data?.error || "Failed to revoke scholarship");
      }

      throw new Error("The server response did not confirm the revocation state.");
    } catch (error) {
      setRevocationError(error instanceof Error ? error.message : "Failed to revoke scholarship");
    } finally {
      setIsRevokingGrantee(false);
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
          <div className="flex flex-wrap items-center gap-2">
            <AdminExportButton
              href={exportHref}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0F3D5C] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0D2E47]"
              iconClassName="h-3.5 w-3.5"
            />
          </div>
        </header>

        <GranteeStatusTable
          grantees={grantees}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          isLoading={isLoading || isSearchLoading}
          startNavigation={(callback) => startTransition(callback)}
          onRevokeGrantee={handleRevokeGranteeRequest}
        />
      </div>
      {scholarshipCandidate ? (
        <RevokeGranteeModal
          granteeId={scholarshipCandidate.id}
          granteeName={scholarshipCandidate.fullName}
          open={Boolean(scholarshipCandidate)}
          submitting={isRevokingGrantee}
          error={revocationError}
          notificationStatus={notificationStatus}
          revocationSaved={revocationSaved}
          archiveRefreshFailed={archiveRefreshFailed}
          notice={revocationNotice}
          onClose={closeRevokeGranteeModal}
          onConfirm={(granteeId, reason, additionalNotes) => {
            void confirmRevokeGrantee(granteeId, reason, additionalNotes);
          }}
        />
      ) : null}
      {revocationSuccess ? (
        <FloatingFeedback
          message={revocationSuccess}
          type="success"
          onDismiss={() => setRevocationSuccess(null)}
        />
      ) : null}
    </>
  );
}
