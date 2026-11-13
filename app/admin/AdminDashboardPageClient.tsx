"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, ClipboardList, FileText, Users } from "lucide-react";
import DashboardHeaderWrapper from "./DashboardHeaderWrapper";
import ScholarDistributionAnalytics, {
  type DashboardMetricCardData,
} from "./ScholarDistributionAnalytics";
import DemographicsSection from "./DemographicsSection";
import type { ScholarDistributionAnalytics as ScholarAnalytics } from "@/lib/admin-scholar-analytics";
import { parseApiJson } from "@/lib/parse-api-json";

interface DashboardOverview {
  stats: {
    openInquiries: number;
    documentReviews: number;
  };
  scholarAnalytics: ScholarAnalytics;
}

interface AdminDashboardPageClientProps {
  dateLabel: string;
  openInquiryCount: number;
  pendingSubmissionCount: number;
  scholarAnalytics: ScholarAnalytics;
}

export default function AdminDashboardPageClient({
  dateLabel,
  openInquiryCount,
  pendingSubmissionCount,
  scholarAnalytics,
}: AdminDashboardPageClientProps) {
  const router = useRouter();
  const [overview, setOverview] = useState<DashboardOverview>({
    stats: {
      openInquiries: openInquiryCount,
      documentReviews: pendingSubmissionCount,
    },
    scholarAnalytics,
  });
  const requestInProgress = useRef(false);

  const metricCards = useMemo<DashboardMetricCardData[]>(() => {
    const analytics = overview.scholarAnalytics;

    return [
      {
        key: "totalYouth",
        href: "/admin/registry/masterlist",
        label: "Total Youth",
        value: analytics.totalRegisteredYouth,
        subtitle: "registered in barangay",
        icon: Users,
        featured: true,
      },
      {
        key: "skeapSlot",
        href: "/admin/skeap/active",
        label: "SKEAP Slot",
        value: `${analytics.capacityUsed} / ${analytics.maxSlots}`,
        subtitle: "maximum slots filled",
        icon: FileText,
      },
      {
        key: "skeapPending",
        href: "/admin/skeap/pending",
        label: "SKEAP Pending",
        value: analytics.pendingApplications,
        subtitle: "needs action",
        icon: CheckSquare,
      },
      {
        key: "kkPending",
        href: "/admin/registry/applications",
        label: "KK Pending",
        value: analytics.pendingProfilingApplications,
        subtitle: "awaiting KK review",
        icon: ClipboardList,
      },
    ];
  }, [overview.scholarAnalytics]);

  useEffect(() => {
    let disposed = false;
    let authRedirected = false;
    let controller: AbortController | null = null;

    const refreshOverview = async () => {
      if (disposed || authRedirected || document.visibilityState !== "visible" || requestInProgress.current) return;
      requestInProgress.current = true;
      controller = new AbortController();

      try {
        const response = await fetch("/api/admin/dashboard-stats", {
          cache: "no-store",
          signal: controller.signal,
        });
        const responsePath = response.url ? new URL(response.url).pathname : "";
        if (response.status === 401 || response.redirected || responsePath === "/login") {
          authRedirected = true;
          const next = `${window.location.pathname}${window.location.search}`;
          router.replace(`/login?reason=session_expired&next=${encodeURIComponent(next)}`);
          return;
        }
        const data = await parseApiJson<DashboardOverview & { error?: string }>(
          response,
          "/api/admin/dashboard-stats",
        );
        if (!response.ok) {
          throw new Error(data?.error || "Unable to refresh the admin dashboard.");
        }
        if (!disposed) setOverview(data);
      } catch (error) {
        if (!disposed && !controller.signal.aborted) {
          console.error("Failed to refresh admin dashboard overview:", error);
        }
      } finally {
        requestInProgress.current = false;
      }
    };

    const interval = window.setInterval(refreshOverview, 15_000);
    const handleFocus = () => void refreshOverview();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshOverview();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void refreshOverview();

    return () => {
      disposed = true;
      controller?.abort();
      requestInProgress.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  return (
    <main className="flex w-full flex-col gap-8 pb-12">
      <DashboardHeaderWrapper
        dateLabel={dateLabel}
        openInquiryCount={overview.stats.openInquiries}
        pendingSubmissionCount={overview.stats.documentReviews}
        operationalSnapshot
      />

      <div className="flex flex-col gap-6 px-4 sm:px-8">
        <ScholarDistributionAnalytics
          analytics={overview.scholarAnalytics}
          metricCards={metricCards}
        />
        <DemographicsSection data={overview.scholarAnalytics} />
      </div>
    </main>
  );
}
