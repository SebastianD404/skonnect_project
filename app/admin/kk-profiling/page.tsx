import { prisma, getProfilingRegistrationCount, getProfilingRegistrationCountByStatus, getWeeklyProfilingRegistrationCount, getWeeklyProfilingRegistrationCountByClassification, getMonthlyProfilingRegistrationCount, hasProfilingRegistrationColumn, listProfilingRegistrations } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { Download, TrendingUp } from "lucide-react";
import { KKProfilingPagination } from "./KKProfilingPagination";
import { KKProfilingRegistrationsTable } from "@/app/admin/kk-profiling/KKProfilingRegistrationsTable";
import KKProfilingStatusTabs from "./KKProfilingStatusTabs";
import TotalRegisteredProfilesCard from "./TotalRegisteredProfilesCard";

const PAGE_SIZE = 7;

export default async function AdminKKProfilingPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; status?: string | string[] }> }) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const resolvedSearchParams = await searchParams;
  const rawPage = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const rawStatus = Array.isArray(resolvedSearchParams.status) ? resolvedSearchParams.status[0] : resolvedSearchParams.status;
  const pageNumber = Math.max(1, Number(rawPage || 1));
  const statusParam = String(rawStatus || "").toLowerCase();
  const skip = (pageNumber - 1) * PAGE_SIZE;

  const hasReviewStatusColumn = await hasProfilingRegistrationColumn("reviewStatus");
  const whereFilter =
    hasReviewStatusColumn && statusParam === "approved"
      ? { reviewStatus: "Approved" }
      : hasReviewStatusColumn && statusParam === "pending"
      ? { reviewStatus: "Pending" }
      : hasReviewStatusColumn && statusParam === "returned"
      ? { reviewStatus: "Returned" }
      : hasReviewStatusColumn && statusParam === "resubmitted"
      ? { reviewStatus: "Resubmitted" }
      : undefined;

  const [
    totalCount,
    weeklyCount,
    monthlyCount,
    inSchoolWeeklyCount,
    outOfSchoolWeeklyCount,
    workingWeeklyCount,
    registrations,
    classificationGroups,
    ageGroupCounts,
  ] = await Promise.all([
    hasReviewStatusColumn
      ? getProfilingRegistrationCountByStatus("Approved")
      : getProfilingRegistrationCount(),
    getWeeklyProfilingRegistrationCount(),
    getMonthlyProfilingRegistrationCount(),
    getWeeklyProfilingRegistrationCountByClassification("In school Youth"),
    getWeeklyProfilingRegistrationCountByClassification("Out of School Youth"),
    getWeeklyProfilingRegistrationCountByClassification("Working Youth"),
    listProfilingRegistrations({
      where: whereFilter,
      orderBy: { submittedAt: "desc" },
      take: PAGE_SIZE,
      skip,
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    }),
    prisma.profilingRegistration.groupBy({
      by: ["youthClassification"],
      _count: {
        _all: true,
      },
    }),
    prisma.profilingRegistration.groupBy({
      by: ["youthAgeGroup"],
      _count: {
        _all: true,
      },
    }),
  ]);

  const ageGroups = {
    "Child Youth (15-17 yrs old)": 0,
    "Core Youth (18-24 yrs old)": 0,
    "Young Adult (15-30 yrs old)": 0,
    Other: 0,
  } as Record<string, number>;

  const classifications = new Map<string, number>();
  const voters = { yes: 0, no: 0, unknown: 0 };
  const assemblies = { attended: 0, notAttended: 0 };

  classificationGroups.forEach((group) => {
    const classification = group.youthClassification?.trim() || "Unknown";
    classifications.set(classification, group._count._all);
  });

  ageGroupCounts.forEach((group) => {
    const label = group.youthAgeGroup?.trim();
    if (label && ageGroups[label] !== undefined) {
      ageGroups[label] = group._count._all;
    } else {
      ageGroups.Other += group._count._all;
    }
  });

  const inSchoolYouthCount = classifications.get("In school Youth") ?? 0;
  const outOfSchoolYouthCount = classifications.get("Out of School Youth") ?? 0;
  const workingYouthCount = classifications.get("Working Youth") ?? 0;

  // Prepare a compact top-classifications list that excludes the three core summary cards
  const coreClassifications = new Set(["In school Youth", "Out of School Youth", "Working Youth"]);
  const otherClassifications = Array.from(classifications.entries()).filter(([k]) => !coreClassifications.has(k));
  const sortedOther = otherClassifications.sort((a, b) => b[1] - a[1]);
  const topClassifications = sortedOther.length > 0 ? sortedOther.slice(0, 5) : Array.from(classifications.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const latestRegistrations = registrations;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const weeklyMomentum = weeklyCount;
  const weeklyBadges = {
    inSchool: inSchoolWeeklyCount,
    outOfSchool: outOfSchoolWeeklyCount,
    working: workingWeeklyCount,
  };

  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-950">
      <div className="px-8 py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">KK Profiling</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                  Registered youth profiling data
                </h1>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Review Katipunan ng Kabataan profiling registrations submitted by SK officials and youth participants. Use this page to monitor demographic coverage, confirm SK voter status, and identify youth who still need follow-up.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.75fr_0.9fr]">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm min-h-0 h-full grid grid-rows-[4rem_auto_auto] gap-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-500">In-school youth</p>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    <TrendingUp className="h-3 w-3" />
                    <span>+{weeklyBadges.inSchool}</span>
                  </div>
                </div>
                <p className="text-3xl font-black text-slate-950">{inSchoolYouthCount}</p>
                <p className="text-sm text-slate-500">Profiles classified as in-school youth</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm min-h-0 h-full grid grid-rows-[4rem_auto_auto] gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Out-of-school youth</p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    <TrendingUp className="h-3 w-3" />
                    <span>+{weeklyBadges.outOfSchool}</span>
                  </div>
                </div>
                <p className="text-3xl font-black text-slate-950">{outOfSchoolYouthCount}</p>
                <p className="text-sm text-slate-500">Profiles classified as out-of-school youth</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm min-h-0 h-full grid grid-rows-[4rem_auto_auto] gap-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Working youth</p>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    <TrendingUp className="h-3 w-3" />
                    <span>+{weeklyBadges.working}</span>
                  </div>
                </div>
                <p className="text-3xl font-black text-slate-950">{workingYouthCount}</p>
                <p className="text-sm text-slate-500">Profiles classified as working youth</p>
              </div>
            </div>
            <TotalRegisteredProfilesCard
              allTimeCount={totalCount}
              monthlyCount={monthlyCount}
              weeklyCount={weeklyCount}
              weeklyMomentum={weeklyMomentum}
            />
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-[#0F3D5C]">Latest entries</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Recent KK profiling submissions</h2>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="/api/admin/kk-profiling/export"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </a>
                <div className="relative">
                  <KKProfilingStatusTabs
                    currentStatus={
                      statusParam === "approved"
                        ? "approved"
                        : statusParam === "returned"
                        ? "returned"
                        : statusParam === "resubmitted"
                        ? "resubmitted"
                        : "pending"
                    }
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <KKProfilingRegistrationsTable
                registrations={latestRegistrations}
                statusLabel={
                  statusParam === "approved"
                    ? "Approved"
                    : statusParam === "returned"
                    ? "Returned"
                    : statusParam === "resubmitted"
                    ? "Resubmitted"
                    : "Pending"
                }
              />
            </div>

            {totalPages > 1 && <KKProfilingPagination pageNumber={pageNumber} totalPages={totalPages} />}
          </div>
        </div>
      </div>
    </div>
  );
}
