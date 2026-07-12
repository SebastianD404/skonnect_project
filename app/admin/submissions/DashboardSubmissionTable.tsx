"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  MoreHorizontal,
  Search,
} from "lucide-react";

export type SubmissionRow = {
  id: string;
  semester: string;
  gradeFileUrl: string;
  coeFileUrl: string;
  generalAverage: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED_FOR_EDIT";
  reviewNotes: string | null;
  flaggedFields?: string[];
  submittedAt: string;
  grantee: {
    user: {
      fullName: string;
      email: string;
      id: string;
    };
    school: string;
    yearLevel: string;
    program: string;
    generalAverage?: number | null;
  };
  reviewer?: {
    fullName: string;
    initials: string;
  };
};

type Props = {
  submissions: {
    pendingCoe: SubmissionRow[];
    activeScholars: SubmissionRow[];
    pendingGrades: SubmissionRow[];
    completed: SubmissionRow[];
  };
  totalCount: number;
};

const tabs = [
  { id: "pending-coe", label: "Pending COE", description: "Phase 1: Enrollment verification" },
  { id: "active-scholars", label: "Awaiting Grades", description: "Phase 2: Grade collection" },
  { id: "pending-grades", label: "Pending Grades Review", description: "Phase 2: Grade verification" },
  { id: "completed", label: "Fully Cleared", description: "Both phases completed" },
];

function getTabCount(submissions: Props["submissions"], tabId: string) {
  switch (tabId) {
    case "pending-coe":
      return submissions.pendingCoe.length;
    case "active-scholars":
      return submissions.activeScholars.length;
    case "pending-grades":
      return submissions.pendingGrades.length;
    case "completed":
      return submissions.completed.length;
    default:
      return 0;
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function formatAverage(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (parsed === null || parsed === undefined || Number.isNaN(parsed)) {
    return "—";
  }
  return parsed.toFixed(2);
}

function StatusPill({ label, variant = "emerald" }: { label: string; variant?: "emerald" | "amber" | "slate" }) {
  const classes = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${classes[variant]}`}>
      <span className="flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: variant === "emerald" ? "#047857" : variant === "amber" ? "#92400e" : "#475569" }} />
      {label}
    </span>
  );
}

function GpaBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800">
      {value}
    </span>
  );
}

function ReviewerPill({ reviewer }: { reviewer?: { fullName: string; initials: string } }) {
  if (!reviewer) {
    return (
      <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        Unassigned
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a2540] text-sm font-bold text-white">
        {reviewer.initials}
      </span>
      <span className="text-sm font-medium text-slate-900">{reviewer.fullName}</span>
    </div>
  );
}

export function DashboardSubmissionTable({ submissions, totalCount }: Props) {
  const [activeTab, setActiveTab] = useState<string>("pending-coe");
  const [semesterSelection, setSemesterSelection] = useState<string>("all");
  const [query, setQuery] = useState<string>("");

  const activeRows = useMemo(() => {
    switch (activeTab) {
      case "pending-coe":
        return submissions.pendingCoe;
      case "active-scholars":
        return submissions.activeScholars;
      case "pending-grades":
        return submissions.pendingGrades;
      case "completed":
      default:
        return submissions.completed;
    }
  }, [activeTab, submissions]);

  const semesterOptions = useMemo(() => {
    const semesters = Array.from(new Set(submissions.completed.map((row) => row.semester)));
    semesters.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    return ["all", ...semesters];
  }, [submissions.completed]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = activeRows.filter((row) => {
      if (!normalizedQuery) return true;
      return (
        row.grantee.user.fullName.toLowerCase().includes(normalizedQuery) ||
        row.grantee.school.toLowerCase().includes(normalizedQuery) ||
        row.grantee.yearLevel.toLowerCase().includes(normalizedQuery) ||
        row.semester.toLowerCase().includes(normalizedQuery)
      );
    });

    if (activeTab !== "completed" || semesterSelection === "all") return rows;
    return rows.filter((row) => row.semester === semesterSelection);
  }, [activeTab, activeRows, query, semesterSelection]);

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Submissions Pipeline</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Confirm academic documents</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm text-slate-700">Total awaiting action</div>
            <div className="rounded-2xl bg-[#0a2540] px-4 py-2 text-sm font-semibold text-white">{totalCount}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSemesterSelection("all");
                }}
                className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "text-[#0a2540]"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-bold ${
                  isActive ? "bg-[#0a2540] text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {isActive ? activeRows.length : getTabCount(submissions, tab.id)}
                </span>
                {isActive && (
                  <span className="absolute -bottom-2 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-cyan-500" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {activeTab === "completed" ? (
              <label className="min-w-[220px]">
                <span className="sr-only">Filter fully cleared submissions by semester</span>
                <select
                  value={semesterSelection}
                  onChange={(e) => setSemesterSelection(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-[#0a2540] focus:outline-none focus:ring-2 focus:ring-[#0a2540]/10"
                >
                  {semesterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "all" ? "All Semesters" : option}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                {tabs.find((tab) => tab.id === activeTab)?.description}
              </div>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                ≡
              </span>
              Advanced
            </button>
            <p className="text-sm text-slate-500">
              {activeTab === "completed" ? `${filteredRows.length} fully cleared` : `${filteredRows.length} items`}
            </p>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-3 md:justify-end">
            <label className="relative block flex-1 min-w-[260px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by grantee, school or semester"
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm text-slate-700 outline-none transition focus:border-[#0a2540] focus:ring-2 focus:ring-[#0a2540]/10"
              />
            </label>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto px-6 pb-6 sm:px-8">
        <table className="min-w-full border-separate border-spacing-y-3 text-left">
          <thead>
            <tr>
              <th className="w-12 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#0a2540] focus:ring-[#0a2540]" />
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Grantee</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">School / Program</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">COE</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Grades</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">GPA</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Submitted</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Reviewer</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="rounded-[22px] bg-white shadow-sm transition hover:shadow-md">
                <td className="px-4 py-4 align-top">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#0a2540] focus:ring-[#0a2540]" />
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0a2540] text-sm font-bold text-white">
                      {getInitials(row.grantee.user.fullName)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{row.grantee.user.fullName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.grantee.user.id} · {row.semester}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="text-sm font-semibold text-slate-950">{row.grantee.school}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.grantee.program}</div>
                </td>
                <td className="px-4 py-4 align-top">
                  <StatusPill label="Approved" />
                </td>
                <td className="px-4 py-4 align-top">
                  <StatusPill label="Approved" />
                </td>
                    <td className="px-4 py-4 align-top">
                      <GpaBadge value={formatAverage(row.generalAverage ?? row.grantee.generalAverage)} />
                    </td>
                <td className="px-4 py-4 align-top text-sm text-slate-700">{new Date(row.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                <td className="px-4 py-4 align-top">
                  <ReviewerPill reviewer={row.reviewer} />
                </td>
                <td className="px-4 py-4 align-top text-right">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2">
                    <button type="button" className="rounded-full p-2 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900">
                      <FileText className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded-full p-2 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900">
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                    <button type="button" className="rounded-full p-2 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-sm text-slate-500">Showing {filteredRows.length} of {totalCount}</p>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 p-2">
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="inline-flex h-10 min-w-[2.25rem] items-center justify-center rounded-2xl bg-[#0a2540] px-3 text-sm font-semibold text-white">
            1
          </button>
          <button type="button" className="inline-flex h-10 min-w-[2.25rem] items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100">
            2
          </button>
          <button type="button" className="inline-flex h-10 min-w-[2.25rem] items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100">
            3
          </button>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
