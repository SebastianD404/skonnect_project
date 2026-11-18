"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminSearch } from "./AdminSearchContext";
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
  const [hasEditedSearch, setHasEditedSearch] = useState(false);
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
    const routeQuery = searchParams.get("q") ?? searchParams.get("search") ?? "";
    if (routeQuery === nextQuery) return;

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextQuery) params.set("q", nextQuery);
      else params.delete("q");
      params.delete("search");
      params.set("page", "1");
      const queryString = params.toString();
      startTransition(() => {
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [pathname, query, router, searchParams, searchQuery, setSearchQuery, startTransition]);
  const isSearchLoading = hasEditedSearch && searchQuery.trim() !== query;
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
    isPermanentlyDisqualified: boolean,
    proofType: string,
    proofFile: File | null,
  ) => {
    if (!scholarshipCandidate || scholarshipCandidate.id !== granteeId) return;
    setIsRevokingGrantee(true);
    setRevocationError(null);
    setRevocationNotice(null);

    try {
      const body = new FormData();
      body.set("status", "REVOKED");
      body.set("reason", reason);
      body.set("additionalNotes", additionalNotes);
      body.set("isPermanentlyDisqualified", String(isPermanentlyDisqualified));
      body.set("proofType", proofType);
      if (proofFile) body.set("proofFile", proofFile, proofFile.name);

      const response = await fetch(`/api/admin/grantees/${granteeId}`, {
        method: "PATCH",
        body,
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
        </header>

        <GranteeStatusTable
          grantees={grantees}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          query={hasEditedSearch ? searchQuery : query}
          onQueryChange={(value) => {
            setHasEditedSearch(true);
            setSearchQuery(value);
          }}
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
          onConfirm={(granteeId, reason, additionalNotes, isPermanentlyDisqualified, proofType, proofFile) => {
            void confirmRevokeGrantee(
              granteeId,
              reason,
              additionalNotes,
              isPermanentlyDisqualified,
              proofType,
              proofFile,
            );
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
