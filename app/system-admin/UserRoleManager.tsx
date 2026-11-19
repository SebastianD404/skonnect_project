"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { Role, SubmissionStatus } from "@prisma/client";
import {
  Download,
  Eye,
  Filter,
  CheckCircle,
  Archive,
  BadgeCheck,
  Check,
  ChevronDown,
  GraduationCap,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Search,
  UserX,
  Users,
  ShieldCheck,
  X,
  XCircle,
  Clock3,
} from "lucide-react";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import { Avatar } from "@/components/ui/Avatar";
import type {
  PlatformAccountMetricKey,
  PlatformAccountMetrics,
} from "@/lib/platform-metrics";
import { getExportButtonLabel } from "@/lib/platform-account-export";

type UserItem = {
  id: string;
  fullName: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  skeapStatus: "Active Scholar" | "Waitlisted" | "Revoked" | "N/A";
  skeapApplicationStatus: SubmissionStatus | null;
  isActive: boolean;
  kkStatus: string;
  granteeStatus: "ACTIVE" | "PROBATIONARY" | "GRADUATED" | "REMOVED" | "REVOKED" | null;
  username: string | null;
  phoneNumber: string | null;
  barangay: string;
  languagePref: string;
  updatedAt: string;
  granteeSchool: string | null;
  granteeYearLevel: string | null;
  granteeGeneralAverage: number | null;
  granteeDateEnrolled: string | null;
  granteeArchivedAt: string | null;
  granteeRetentionExpiresAt: string | null;
  createdAt: string;
};

type Props = {
  users: UserItem[];
  metrics: PlatformAccountMetrics;
  selectedMetric: PlatformAccountMetricKey;
  selectedRole: RoleFilter;
  searchQuery: string;
  totalCount: number;
  currentUserId: string | null;
};

type RoleFilter = "ALL" | Role;
type RoleChangeCandidate = {
  user: UserItem;
  nextRole: Role;
};

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "YOUTH", label: "Youth" },
  { value: "GRANTEE", label: "Grantee" },
  { value: "SK_OFFICIAL", label: "SK Admin" },
  { value: "SUPER_ADMIN", label: "System Admin" },
];

const ROLE_FILTER_LABELS: Record<Role, string> = {
  YOUTH: "Youth",
  GRANTEE: "Grantee",
  SK_OFFICIAL: "SK Official",
  SUPER_ADMIN: "Super Admin",
};

function getRoleFilterLabel(role: RoleFilter) {
  return role === "ALL" ? "All Roles" : ROLE_FILTER_LABELS[role];
}

const SCHOLAR_STATUS_BADGES = {
  WAITLISTED: {
    label: "Waitlisted",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    Icon: Clock3,
  },
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: CheckCircle,
  },
  PROBATIONARY: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: CheckCircle,
  },
  GRADUATED: {
    label: "Graduated",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    Icon: GraduationCap,
  },
  REMOVED: {
    label: "Removed",
    className: "bg-red-50 text-red-700 border-red-200",
    Icon: XCircle,
  },
  REVOKED: {
    label: "Revoked",
    className: "bg-red-50 text-red-700 border-red-200",
    Icon: XCircle,
  },
} as const;

const ACCOUNT_STATUS_BADGES = {
  ACTIVE: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: CheckCircle,
  },
  INACTIVE: {
    label: "Inactive",
    className: "bg-red-50 text-red-700 border-red-200",
    Icon: XCircle,
  },
} as const;

const SKEAP_STATUS_BADGES = {
  "Active Scholar": {
    label: "Active Scholar",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: CheckCircle,
  },
  Waitlisted: {
    label: "Waitlisted",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    Icon: Clock3,
  },
  Revoked: {
    label: "Revoked",
    className: "bg-red-50 text-red-700 border-red-200",
    Icon: XCircle,
  },
} as const;

function formatDetailDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDetailDateOnly(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-700">{children}</dd>
    </div>
  );
}

export default function UserRoleManager({
  users,
  metrics,
  selectedMetric,
  selectedRole,
  searchQuery,
  totalCount,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(searchQuery);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(selectedRole);
  const [optimisticSegment, setOptimisticSegment] = useState<PlatformAccountMetricKey>(selectedMetric);
  const [showRoleFilterMenu, setShowRoleFilterMenu] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserItem | null>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [roleCandidate, setRoleCandidate] = useState<RoleChangeCandidate | null>(null);
  const [statusCandidate, setStatusCandidate] = useState<UserItem | null>(null);
  const [openActionsUserId, setOpenActionsUserId] = useState<string | null>(null);
  const [openMobileRoleMenuUserId, setOpenMobileRoleMenuUserId] = useState<string | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState({ top: 0, left: 0 });
  const actionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileRoleMenuRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showDelayedSkeleton, setShowDelayedSkeleton] = useState(false);

  useEffect(() => {
    setQuery(searchQuery);
    setRoleFilter(selectedRole);
    setOptimisticSegment(selectedMetric);
  }, [searchQuery, selectedMetric, selectedRole]);

  useEffect(() => () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }, []);

  useEffect(() => {
    let lastRefreshAt = Date.now();
    const refreshVisiblePage = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshAt < 3_000) return;
      lastRefreshAt = now;
      router.refresh();
    };

    const interval = window.setInterval(refreshVisiblePage, 15_000);
    window.addEventListener("focus", refreshVisiblePage);
    document.addEventListener("visibilitychange", refreshVisiblePage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisiblePage);
      document.removeEventListener("visibilitychange", refreshVisiblePage);
    };
  }, [router]);

  useEffect(() => {
    if (!isPending) {
      setShowDelayedSkeleton(false);
      return;
    }

    setShowDelayedSkeleton(false);
    const timeout = window.setTimeout(() => setShowDelayedSkeleton(true), 200);
    return () => window.clearTimeout(timeout);
  }, [isPending]);

  useEffect(() => {
    if (!openActionsUserId && !openMobileRoleMenuUserId) return;

    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      if (
        openActionsUserId &&
        !actionsMenuRef.current?.contains(target) &&
        !actionsTriggerRef.current?.contains(target)
      ) {
        setOpenActionsUserId(null);
      }
      if (openMobileRoleMenuUserId && !mobileRoleMenuRef.current?.contains(target)) {
        setOpenMobileRoleMenuUserId(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenActionsUserId(null);
        setOpenMobileRoleMenuUserId(null);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openActionsUserId, openMobileRoleMenuUserId]);

  useLayoutEffect(() => {
    if (!openActionsUserId) return;

    function updateMenuPosition() {
      const trigger = actionsTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = 192;
      const menuHeight = 190;
      const top = rect.bottom + menuHeight + 8 <= window.innerHeight
        ? rect.bottom + 6
        : Math.max(8, rect.top - menuHeight - 6);
      const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
      setActionsMenuPosition({ top, left });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [openActionsUserId]);

  const accountMetricCards = [
    {
      key: "all" as const,
      label: "Total Platform Accounts",
      caption: "100% of registered accounts",
      value: metrics.totalAccounts,
      Icon: Users,
      tone: "text-slate-700",
    },
    {
      key: "verified" as const,
      label: "Verified KK Youth & Grantees",
      caption: "Matches SK Admin Registry",
      value: metrics.activeKkYouthAndGrantees,
      Icon: BadgeCheck,
      tone: "text-emerald-700",
    },
    {
      key: "pending" as const,
      label: "Pending / Unprofiled",
      caption: "Awaiting KK approval",
      value: metrics.unprofiledOrPending,
      Icon: Clock3,
      tone: "text-amber-700",
    },
    {
      key: "adminStaff" as const,
      label: "SK & System Admins",
      caption: "SK Council & Super Admins",
      value: metrics.adminStaff,
      Icon: ShieldCheck,
      tone: "text-blue-700",
    },
    {
      key: "archived" as const,
      label: "Archived / Inactive",
      caption: "Aged out 31+ or archived",
      value: metrics.archivedOrInactive,
      Icon: Archive,
      tone: "text-slate-500",
    },
  ];
  const expectedSegmentCount =
    accountMetricCards.find(({ key }) => key === optimisticSegment)?.value ?? totalCount;
  const exportButtonLabel = getExportButtonLabel({
    count: totalCount,
    metric: optimisticSegment,
    role: roleFilter === "ALL" ? null : roleFilter,
    searchQuery: query,
  });
  const skeletonRowCount = Math.min(expectedSegmentCount || 8, 8);
  const shouldShowSkeleton = isPending && showDelayedSkeleton;
  const areRowsStale = isPending && !showDelayedSkeleton;

  function navigateToList(metric: PlatformAccountMetricKey, role: RoleFilter, search: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("metric", metric);
    if (role === "ALL") params.delete("role");
    else params.set("role", role);
    if (search.trim()) params.set("q", search.trim());
    else params.delete("q");
    params.set("page", "1");
    startTransition(() => {
      router.push(`/system-admin/users?${params.toString()}`, { scroll: false });
    });
  }

  function filterByAccountMetric(metric: PlatformAccountMetricKey) {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setOptimisticSegment(metric);
    navigateToList(metric, roleFilter, query);
  }

  function filterByRole(role: RoleFilter) {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setRoleFilter(role);
    navigateToList(optimisticSegment, role, query);
  }

  function handleSearchChange(value: string) {
    setQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      navigateToList(optimisticSegment ?? "all", roleFilter, value);
    }, 250);
  }

  function resetSearchAndRoleFilters() {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setQuery("");
    setRoleFilter("ALL");
    setShowRoleFilterMenu(false);
    navigateToList(optimisticSegment, "ALL", "");
  }

  function updateRole(userId: string, role: Role) {
    const user = users.find((item) => item.id === userId);
    if (!user || user.role === role || (isPending && pendingUserId !== userId)) return;

    setPendingUserId(userId);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/system-admin/users/${userId}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || "Failed to update role");
        }

        setMessage({ type: "success", text: "Role updated successfully." });
        router.refresh();
      } catch (error) {
        const text = error instanceof Error ? error.message : "Failed to update role";
        setMessage({ type: "error", text });
      } finally {
        setPendingUserId(null);
      }
    });
  }

  function isActiveScholar(user: UserItem) {
    return user.granteeStatus
      ? user.granteeStatus === "ACTIVE" || user.granteeStatus === "PROBATIONARY"
      : user.skeapApplicationStatus === "APPROVED";
  }

  function renderRoleBadge(user: UserItem) {
    const roleBadge: Record<Role, { label: string; className: string }> = {
      YOUTH: {
        label: "Youth",
        className: "border border-slate-200 bg-slate-100 text-slate-700",
      },
      GRANTEE: {
        label: "Grantee",
        className: "border border-sky-200 bg-sky-50 text-sky-700",
      },
      SK_OFFICIAL: {
        label: "SK Admin",
        className: "border border-blue-200 bg-blue-50 text-blue-700",
      },
      SUPER_ADMIN: {
        label: "System Admin",
        className: "bg-slate-900 text-white",
      },
    };
    const badge = roleBadge[user.role];

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>
        {badge.label}
      </span>
    );
  }

  function getRoleChangeTarget(user: UserItem): Role | null {
    if (user.role === "SUPER_ADMIN" || user.id === currentUserId) return null;
    if (user.role === "SK_OFFICIAL") return "YOUTH";
    if (
      user.role === "YOUTH" &&
      !user.granteeStatus &&
      user.skeapApplicationStatus !== "APPROVED"
    ) {
      return "SK_OFFICIAL";
    }

    return null;
  }

  function hasRoleGovernanceMenu(user: UserItem) {
    if (user.role === "SUPER_ADMIN" || user.id === currentUserId) return false;
    return Boolean(
      getRoleChangeTarget(user) ||
      user.role === "GRANTEE" ||
      isActiveScholar(user)
    );
  }

  function renderRoleGovernanceMenuItem(user: UserItem) {
    const nextRole = getRoleChangeTarget(user);
    if (nextRole) {
      const appointing = nextRole === "SK_OFFICIAL";
      return (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpenActionsUserId(null);
            setOpenMobileRoleMenuUserId(null);
            setRoleCandidate({ user, nextRole });
          }}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
            appointing
              ? "text-slate-700 hover:bg-slate-50"
              : "text-rose-700 hover:bg-rose-50"
          }`}
        >
          {appointing
            ? <CheckCircle className="h-4 w-4 text-slate-500" aria-hidden="true" />
            : <UserX className="h-4 w-4 text-rose-600" aria-hidden="true" />}
          {appointing ? "Appoint as SK Admin" : "Remove SK Admin"}
        </button>
      );
    }

    if (
      user.id !== currentUserId &&
      user.role !== "SUPER_ADMIN" &&
      (user.role === "GRANTEE" || isActiveScholar(user))
    ) {
      return (
        <div
          role="menuitem"
          aria-disabled="true"
          className="cursor-not-allowed rounded-lg px-3 py-2 text-xs font-medium text-slate-400"
        >
          Role managed via SKEAP
        </div>
      );
    }

    return null;
  }

  function confirmRoleChange() {
    if (!roleCandidate) return;
    const { user, nextRole } = roleCandidate;
    setRoleCandidate(null);
    updateRole(user.id, nextRole);
  }

  async function handleExportUsersExcel() {
    if (isExporting) return;
    if (isPending) return;
    if (totalCount === 0) {
      window.alert("No records found to export for the selected filter.");
      return;
    }

    setIsExporting(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({
        role: roleFilter,
        metric: optimisticSegment,
        q: query.trim(),
      });
      const response = await fetch(`/api/system-admin/users/export?${params.toString()}`);
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Unable to export users.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = contentDisposition?.match(/filename="([^"]+)"/i)?.[1]
        ?? "skonnect-accounts.xlsx";
      link.href = objectUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage({ type: "success", text: `Exported ${totalCount.toLocaleString()} matching accounts.` });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to export users.",
      });
    } finally {
      setIsExporting(false);
    }
  }

  function openEditUser(user: UserItem) {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditEmail(user.email);
    setEditPhoneNumber(user.phoneNumber ?? "");
  }

  function submitEditUser() {
    if (!editingUser) return;

    setPendingUserId(editingUser.id);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/system-admin/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: editFullName,
            email: editEmail,
            phoneNumber: editPhoneNumber,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || "Failed to update user details");
        }

        setMessage({ type: "success", text: "User details updated." });
        setEditingUser(null);
        router.refresh();
      } catch (error) {
        const text = error instanceof Error ? error.message : "Failed to update user details";
        setMessage({ type: "error", text });
      } finally {
        setPendingUserId(null);
      }
    });
  }

  function requestUserStatusChange(user: UserItem) {
    setStatusCandidate(user);
    setMessage(null);
  }

  function toggleUserStatus() {
    if (!statusCandidate) return;
    const user = statusCandidate;
    const nextIsActive = !user.isActive;
    if (user.role === "SUPER_ADMIN" && !nextIsActive) {
      setStatusCandidate(null);
      setMessage({ type: "error", text: "SUPER_ADMIN accounts cannot be deactivated." });
      return;
    }
    const action = nextIsActive ? "Reactivate" : "Deactivate";

    setPendingUserId(user.id);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/system-admin/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: nextIsActive }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || `Failed to ${action.toLowerCase()} user`);
        }

        setMessage({ type: "success", text: `User ${nextIsActive ? "reactivated" : "deactivated"}.` });
        setStatusCandidate(null);
        router.refresh();
      } catch (error) {
        const text = error instanceof Error ? error.message : `Failed to ${action.toLowerCase()} user`;
        setMessage({ type: "error", text });
      } finally {
        setPendingUserId(null);
      }
    });
  }

  return (
    <>
      {message ? (
        <FloatingFeedback
          message={message.text}
          type={message.type}
          autoDismissMs={message.type === "error" ? 3000 : 4500}
          onDismiss={() => setMessage(null)}
        />
      ) : null}

      <section className="mb-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {accountMetricCards.map(({ key, label, caption, value, Icon, tone }) => {
            const isSelected = optimisticSegment === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${label}: ${value.toLocaleString()}. Click to filter users.`}
                onClick={() => filterByAccountMetric(key)}
                className={`group relative flex min-h-[128px] min-w-0 flex-col justify-between gap-3 overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_6px_24px_-6px_rgba(14,116,144,0.09)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  isSelected
                    ? "border-blue-600 ring-2 ring-blue-600/20"
                    : "border-slate-200/75 hover:border-cyan-200 hover:shadow-[0_8px_28px_-6px_rgba(14,116,144,0.14)]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse 58% 70% at 95% 5%, rgba(56, 189, 248, 0.16) 0%, rgba(103, 232, 249, 0.06) 42%, transparent 100%)",
                  }}
                />
                {isSelected ? (
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
                ) : null}
                <span className="relative z-10 flex min-w-0 items-center justify-between gap-2">
                  <span className={`min-w-0 text-[10px] font-bold uppercase leading-tight tracking-widest ${isSelected ? "text-cyan-700" : "text-slate-400"}`}>
                    {label}
                  </span>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isSelected
                      ? "bg-cyan-700 text-white shadow-[0_0_0_5px_rgba(8,145,178,0.10)]"
                      : "border border-sky-100 bg-sky-50/90 text-cyan-600"
                  }`}>
                    <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-white" : tone}`} aria-hidden="true" />
                  </span>
                </span>
                <span className="relative z-10 block text-xl font-black leading-none text-slate-950 tabular-nums">
                  {value.toLocaleString()}
                </span>
                <span className="relative z-10 block text-[10px] leading-snug text-slate-500">
                  {caption}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="relative min-w-[240px] max-w-sm flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search by name or email..."
                aria-label="Search users by name or email"
                className="h-10 w-full rounded-xl border border-slate-200/90 bg-slate-50/60 pl-9 pr-8 text-[13px] text-slate-800 placeholder:text-slate-400 transition focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/15"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                    setQuery("");
                    navigateToList(optimisticSegment, roleFilter, "");
                  }}
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={showRoleFilterMenu}
                className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[13px] font-medium shadow-2xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/20 ${
                  roleFilter === "ALL"
                    ? "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    : "border-sky-200 bg-sky-50/80 text-sky-900 hover:bg-sky-50"
                }`}
                onClick={() => setShowRoleFilterMenu((prev) => !prev)}
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
                {getRoleFilterLabel(roleFilter)}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              </button>
              {showRoleFilterMenu ? (
                <div
                  role="menu"
                  aria-label="Filter users by role"
                  className="absolute left-0 top-11 z-20 w-56 overflow-hidden rounded-xl border border-[#D8E3EC] bg-white py-1 shadow-lg"
                >
                  <button
                    type="button"
                    aria-pressed={roleFilter === "ALL"}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      filterByRole("ALL");
                      setShowRoleFilterMenu(false);
                    }}
                  >
                    All Roles
                    {roleFilter === "ALL" ? <Check className="h-4 w-4 text-blue-700" aria-hidden="true" /> : null}
                  </button>
                  <div className="mx-3 my-1 border-t border-slate-100 pt-2">
                    <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Program Roles
                    </p>
                    {ROLE_OPTIONS.slice(0, 2).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={roleFilter === option.value}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          filterByRole(option.value);
                          setShowRoleFilterMenu(false);
                        }}
                      >
                          {getRoleFilterLabel(option.value)}
                        {roleFilter === option.value ? <Check className="h-4 w-4 text-blue-700" aria-hidden="true" /> : null}
                      </button>
                    ))}
                  </div>
                  <div className="mx-3 my-1 border-t border-slate-100 pt-2">
                    <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Administrative Roles
                    </p>
                    {ROLE_OPTIONS.slice(2).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={roleFilter === option.value}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          filterByRole(option.value);
                          setShowRoleFilterMenu(false);
                        }}
                      >
                          {getRoleFilterLabel(option.value)}
                        {roleFilter === option.value ? <Check className="h-4 w-4 text-blue-700" aria-hidden="true" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {query.trim() || roleFilter !== "ALL" ? (
              <button
                type="button"
                onClick={resetSearchAndRoleFilters}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/20"
              >
                Reset
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
            <div className="whitespace-nowrap text-xs text-slate-500 tabular-nums" aria-live="polite">
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {users.length.toLocaleString()}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-800">
                {totalCount.toLocaleString()}
              </span>
            </div>
            <span className="hidden h-5 w-px bg-slate-200 sm:inline-block" aria-hidden="true" />
            <button
              type="button"
              disabled={isExporting || isPending}
              aria-busy={isExporting}
              aria-label={exportButtonLabel}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0F2942] px-4 text-[13px] font-semibold text-white shadow-2xs transition hover:bg-[#163859] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleExportUsersExcel}
            >
              {isExporting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="whitespace-nowrap tabular-nums">
                {isExporting ? "Exporting..." : exportButtonLabel}
              </span>
            </button>
          </div>
        </div>
        <div className="min-h-[540px]">
        {isPending || users.length > 0 ? (
          <>
            <div className="relative hidden w-full overflow-x-auto whitespace-nowrap md:block">
            <table className="hidden w-full min-w-[1080px] table-fixed text-sm md:table" aria-busy={isPending}>
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[13%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead className="bg-slate-900 text-[11px] font-bold tracking-wider text-white uppercase">
                <tr className="text-left">
                  <th className="py-4 pl-[72px] pr-6">User / Email</th>
                  <th className="px-6 py-4">Current Role</th>
                  <th className="px-6 py-4">Account Status</th>
                  <th className="px-6 py-4">SKEAP Status</th>
                  <th className="whitespace-nowrap px-6 py-4">Joined Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
                <tr aria-hidden="true">
                  <th colSpan={6} className="h-[2px] p-0">
                    <div className="h-[2px] overflow-hidden bg-slate-900">
                      <span
                        className={`system-users-progress-bar block h-full w-1/3 bg-blue-400 transition-opacity duration-150 ${
                          isPending ? "opacity-100" : "opacity-0"
                        }`}
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody
                className={`divide-y divide-slate-100 transition-opacity duration-150 ${
                  areRowsStale ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {shouldShowSkeleton ? Array.from({ length: skeletonRowCount }, (_, index) => (
                  <tr key={`skeleton-${index}`} aria-hidden="true" className="h-[68px]">
                    <td className="min-w-0 px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span className="system-users-skeleton h-9 w-9 shrink-0 rounded-full" />
                        <span className="min-w-0 flex-1 space-y-2">
                          <span className="system-users-skeleton block h-3 w-36 rounded" />
                          <span className="system-users-skeleton block h-2.5 w-48 rounded" />
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3"><span className="system-users-skeleton block h-6 w-20 rounded-full" /></td>
                    <td className="px-6 py-3"><span className="flex items-center gap-2"><span className="system-users-skeleton h-2 w-2 rounded-full" /><span className="system-users-skeleton h-3 w-14 rounded" /></span></td>
                    <td className="px-6 py-3"><span className="system-users-skeleton block h-6 w-24 rounded-md" /></td>
                    <td className="whitespace-nowrap px-6 py-3"><span className="system-users-skeleton block h-3 w-20 rounded" /></td>
                    <td className="px-6 py-3 text-right"><span className="system-users-skeleton ml-auto block h-8 w-8 rounded-full" /></td>
                  </tr>
                )) : users.map((user) => {
                  const busy = isPending && pendingUserId === user.id;
                  const scholarStatusBadge = user.skeapStatus === "N/A"
                    ? null
                    : SKEAP_STATUS_BADGES[user.skeapStatus];
                  return (
                    <tr
                      key={user.id}
                      className={`h-[68px] transition-colors hover:bg-slate-50/50 ${
                        isPending ? "" : "animate-in fade-in duration-150 system-users-row-enter"
                      }`}
                    >
                      <td className="min-w-0 px-6 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar
                            src={user.avatarUrl}
                            alt={user.displayName || "User"}
                            size={36}
                            className="h-9 w-9"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-slate-900">{user.displayName || "Unnamed User"}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {renderRoleBadge(user)}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`flex items-center gap-1.5 text-sm font-medium ${user.isActive ? "text-emerald-700" : "text-slate-500"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                          {user.kkStatus === "AGED_OUT" ? (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              KK Aged Out
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {scholarStatusBadge ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${scholarStatusBadge.className}`}
                          >
                            <scholarStatusBadge.Icon className="h-3 w-3" aria-hidden="true" />
                            {scholarStatusBadge.label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                            N/A
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-xs tabular-nums text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-right">
                        <div className="flex flex-nowrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenActionsUserId((current) => current === user.id ? null : user.id)}
                            title={`Actions for ${user.displayName}`}
                            aria-label={`Actions for ${user.displayName}`}
                            aria-haspopup="menu"
                            aria-expanded={openActionsUserId === user.id}
                            ref={openActionsUserId === user.id ? actionsTriggerRef : null}
                            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {openActionsUserId === user.id && typeof document !== "undefined" ? createPortal(
                            <div
                              ref={actionsMenuRef}
                              role="menu"
                              aria-label={`Actions for ${user.displayName}`}
                              className="fixed z-[100] w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                              style={actionsMenuPosition}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenActionsUserId(null);
                                  setViewingUser(user);
                                }}
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <Eye className="h-4 w-4 text-slate-500" aria-hidden="true" />
                                View details
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenActionsUserId(null);
                                  openEditUser(user);
                                }}
                                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <Pencil className="h-4 w-4 text-slate-500" aria-hidden="true" />
                                Edit profile
                              </button>
                              {renderRoleGovernanceMenuItem(user)}
                              <div className="my-1.5 border-t border-slate-100" role="separator" />
                              {(!user.isActive || user.role !== "SUPER_ADMIN") && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenActionsUserId(null);
                                    requestUserStatusChange(user);
                                  }}
                                  disabled={busy}
                                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                    user.isActive
                                      ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                                      : "text-emerald-700 hover:bg-emerald-50"
                                  }`}
                                >
                                  {user.isActive ? (
                                    <UserX className="h-4 w-4" aria-hidden="true" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4" aria-hidden="true" />
                                  )}
                                  {user.isActive ? "Deactivate Account" : "Reactivate Account"}
                                </button>
                              )}
                            </div>,
                            document.body
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            <div
              className={`flex flex-col gap-4 p-4 transition-opacity duration-150 md:hidden ${
                areRowsStale ? "pointer-events-none opacity-50" : ""
              }`}
              aria-busy={isPending}
            >
              {shouldShowSkeleton ? Array.from({ length: skeletonRowCount }, (_, index) => (
                <div key={`mobile-skeleton-${index}`} aria-hidden="true" className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <span className="system-users-skeleton h-11 w-11 rounded-full" />
                    <span className="space-y-2"><span className="system-users-skeleton block h-3 w-32 rounded" /><span className="system-users-skeleton block h-2.5 w-40 rounded" /></span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3"><span className="system-users-skeleton h-6 rounded-full" /><span className="system-users-skeleton h-6 rounded-full" /></div>
                </div>
              )) : users.map((user) => {
                const busy = isPending && pendingUserId === user.id;
                const scholarStatusBadge = user.skeapStatus === "N/A"
                  ? null
                  : SKEAP_STATUS_BADGES[user.skeapStatus];

                return (
                  <article
                    key={user.id}
                    className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${
                      isPending ? "" : "animate-in fade-in duration-150 system-users-row-enter"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        src={user.avatarUrl}
                        alt={user.displayName || "User"}
                        size={44}
                        className="h-11 w-11 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-bold text-slate-900">
                          {user.displayName || "Unnamed User"}
                        </h3>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                      <div className="min-w-0">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Current Role
                        </dt>
                        <dd className="mt-1">{renderRoleBadge(user)}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Account Status
                        </dt>
                        <dd className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium ${user.isActive ? "text-emerald-700" : "text-slate-500"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {user.isActive ? "Active" : "Inactive"}
                        </dd>
                        {user.kkStatus === "AGED_OUT" ? (
                          <dd className="mt-1">
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              KK Aged Out
                            </span>
                          </dd>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          SKEAP Status
                        </dt>
                        <dd className="mt-1">
                          {scholarStatusBadge ? (
                            <span className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${scholarStatusBadge.className}`}>
                              <scholarStatusBadge.Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">{scholarStatusBadge.label}</span>
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-400">N/A</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Joined Date
                        </dt>
                        <dd className="mt-1 text-sm tabular-nums text-slate-600">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => setViewingUser(user)}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditUser(user)}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit profile
                      </button>
                      {(!user.isActive || user.role !== "SUPER_ADMIN") ? (
                        <button
                          type="button"
                          onClick={() => requestUserStatusChange(user)}
                          disabled={busy}
                          className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                            user.isActive
                              ? "border-red-200 text-red-600 hover:bg-red-50"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {user.isActive ? (
                            <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {user.isActive ? "Deactivate account" : "Reactivate account"}
                        </button>
                      ) : null}
                      {hasRoleGovernanceMenu(user) ? (
                        <div
                          ref={openMobileRoleMenuUserId === user.id ? mobileRoleMenuRef : null}
                          className="relative ml-auto"
                        >
                          <button
                            type="button"
                            onClick={() => setOpenMobileRoleMenuUserId((current) =>
                              current === user.id ? null : user.id
                            )}
                            title={`Role actions for ${user.displayName}`}
                            aria-label={`Role actions for ${user.displayName}`}
                            aria-haspopup="menu"
                            aria-expanded={openMobileRoleMenuUserId === user.id}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {openMobileRoleMenuUserId === user.id ? (
                            <div
                              role="menu"
                              aria-label={`Role actions for ${user.displayName}`}
                              className="absolute bottom-full right-0 z-30 mb-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                            >
                              {renderRoleGovernanceMenuItem(user)}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-8 sm:p-10">
            <p className="text-lg font-semibold text-slate-900">
              {query.trim() ? "No users match your search." : "No users in this view."}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {query.trim()
                ? `No accounts match “${query.trim()}” within the selected filters.`
                : optimisticSegment && optimisticSegment !== "all"
                  ? `There are no accounts in ${accountMetricCards.find(({ key }) => key === optimisticSegment)?.label ?? "this metric"} right now.`
                  : roleFilter !== "ALL"
                    ? `There are no ${roleFilter.replaceAll("_", " ").toLowerCase()} accounts matching the current filters.`
                    : "No user profiles are available yet."}
            </p>
            {query.trim() ? (
              <button
                type="button"
                onClick={() => {
                  if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                  setQuery("");
                  navigateToList(optimisticSegment ?? "all", roleFilter, "");
                }}
                className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Clear search
              </button>
            ) : optimisticSegment !== "all" || roleFilter !== "ALL" ? (
              <button
                type="button"
                onClick={() => {
                  setOptimisticSegment("all");
                  setRoleFilter("ALL");
                  navigateToList("all", "ALL", "");
                }}
                className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                View all accounts
              </button>
            ) : null}
          </div>
        )}
        </div>
      </div>

      {roleCandidate ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-change-title"
            aria-describedby="role-change-description"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className={`border-t-4 p-5 ${roleCandidate.nextRole === "SK_OFFICIAL" ? "border-cyan-600" : "border-rose-600"}`}>
              <h2 id="role-change-title" className="text-base font-semibold text-slate-950">
                {roleCandidate.nextRole === "SK_OFFICIAL" ? "Appoint as SK Admin?" : "Remove SK Admin access?"}
              </h2>
              <p id="role-change-description" className="mt-2 text-sm leading-6 text-slate-600">
                {roleCandidate.nextRole === "SK_OFFICIAL" ? (
                  <>
                    Appoint {roleCandidate.user.displayName || roleCandidate.user.fullName} as an SK Admin? They will gain access to the SK Admin workspace to review applications, manage youth records, and generate reports.
                  </>
                ) : (
                  <>
                    Revoke SK Admin access for {roleCandidate.user.displayName || roleCandidate.user.fullName}? Their administrative workspace privileges will be removed and their account will return to standard Youth access.
                  </>
                )}
              </p>
              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setRoleCandidate(null)}
                  disabled={isPending && pendingUserId === roleCandidate.user.id}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRoleChange}
                  disabled={isPending}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${roleCandidate.nextRole === "SK_OFFICIAL" ? "bg-[#0F3D5C] hover:bg-[#0a2f47]" : "bg-rose-700 hover:bg-rose-800"}`}
                >
                  {roleCandidate.nextRole === "SK_OFFICIAL" ? "Appoint as SK Admin" : "Remove SK Admin"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewingUser ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 px-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#D6E1EC] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  src={viewingUser.avatarUrl}
                  alt={viewingUser.displayName || "User"}
                  size={48}
                  className="h-12 w-12 shrink-0 bg-slate-100 text-slate-600"
                />
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-slate-900">
                    {viewingUser.displayName || "Unnamed User"}
                  </h3>
                  <p className="truncate text-sm text-slate-500">{viewingUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setViewingUser(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">System Role</span>
                <div className="mt-1.5">
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {ROLE_OPTIONS.find((option) => option.value === viewingUser.role)?.label ?? viewingUser.role}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account Access</span>
                {(() => {
                  const badge = ACCOUNT_STATUS_BADGES[viewingUser.isActive ? "ACTIVE" : "INACTIVE"];
                  return (
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                        <badge.Icon className="h-3 w-3" aria-hidden="true" />
                        {badge.label}
                      </span>
                    </div>
                  );
                })()}
                {viewingUser.kkStatus === "AGED_OUT" ? (
                  <div className="mt-1.5">
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      KK Aged Out
                    </span>
                  </div>
                ) : null}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SKEAP Status</span>
                <div className="mt-1.5">
                  {viewingUser.granteeStatus ? (
                    (() => {
                      const badge = SCHOLAR_STATUS_BADGES[viewingUser.granteeStatus];
                      return (
                        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                          <badge.Icon className="h-3 w-3" aria-hidden="true" />
                          {badge.label}
                        </span>
                      );
                    })()
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                      N/A
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Joined</span>
                <p className="mt-1.5 text-sm font-medium text-slate-700">
                  {formatDetailDate(viewingUser.createdAt)}
                </p>
              </div>
            </div>
            <section className="mt-6 border-t border-slate-100 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Account information</h4>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <DetailItem label="Username">{viewingUser.username || "Not set"}</DetailItem>
                <DetailItem label="Phone number">{viewingUser.phoneNumber || "Not provided"}</DetailItem>
                <DetailItem label="Barangay">{viewingUser.barangay || "—"}</DetailItem>
                <DetailItem label="Language preference">{viewingUser.languagePref}</DetailItem>
                <DetailItem label="Last account update">{formatDetailDate(viewingUser.updatedAt)}</DetailItem>
              </dl>
            </section>
            {viewingUser.granteeStatus ? (
              <section className="mt-6 border-t border-slate-100 pt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">SKEAP scholar details</h4>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                  <DetailItem label="School">{viewingUser.granteeSchool || "—"}</DetailItem>
                  <DetailItem label="Year level">{viewingUser.granteeYearLevel || "—"}</DetailItem>
                  <DetailItem label="General average">
                    {viewingUser.granteeGeneralAverage !== null
                      ? viewingUser.granteeGeneralAverage.toFixed(2)
                      : "No record"}
                  </DetailItem>
                  <DetailItem label="Enrollment date">
                    {formatDetailDateOnly(viewingUser.granteeDateEnrolled)}
                  </DetailItem>
                  {viewingUser.granteeArchivedAt ? (
                    <>
                      <DetailItem label={viewingUser.granteeStatus === "GRADUATED" ? "Graduation date" : "Removal date"}>
                        {formatDetailDateOnly(viewingUser.granteeArchivedAt)}
                      </DetailItem>
                      {viewingUser.granteeRetentionExpiresAt ? (
                        <DetailItem label="Retention ends">
                          {formatDetailDateOnly(viewingUser.granteeRetentionExpiresAt)}
                        </DetailItem>
                      ) : null}
                    </>
                  ) : null}
                </dl>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {editingUser ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#D6E1EC] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Edit user profile</h3>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setEditingUser(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 text-sm text-slate-500">
              Update the user&apos;s name and contact details. Manage SK Admin access using the governance controls in the user list.
            </p>
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Full name</span>
                <input
                  value={editFullName}
                  onChange={(event) => setEditFullName(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#CFDBE7] px-3 text-sm outline-none focus:border-[#4B96C6] focus:ring-2 focus:ring-[#4B96C6]/20"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Phone number</span>
                <input
                  type="tel"
                  maxLength={32}
                  value={editPhoneNumber}
                  onChange={(event) => setEditPhoneNumber(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#CFDBE7] px-3 text-sm outline-none focus:border-[#4B96C6] focus:ring-2 focus:ring-[#4B96C6]/20"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-slate-600">Email</span>
                <input
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#CFDBE7] px-3 text-sm outline-none focus:border-[#4B96C6] focus:ring-2 focus:ring-[#4B96C6]/20"
                />
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-lg border border-[#CFDBE7] px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isPending && pendingUserId === editingUser.id}
                  onClick={submitEditUser}
                >
                  {isPending && pendingUserId === editingUser.id ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {statusCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-status-title"
            aria-describedby="user-status-description"
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className={`border-t-4 p-5 ${statusCandidate.isActive ? "border-amber-500" : "border-emerald-600"}`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${statusCandidate.isActive ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {statusCandidate.isActive ? (
                    <UserX className="h-[18px] w-[18px]" aria-hidden="true" />
                  ) : (
                    <CheckCircle className="h-[18px] w-[18px]" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 pt-0.5">
                  <h2 id="user-status-title" className="text-base font-semibold text-slate-950">
                    {statusCandidate.isActive ? "Deactivate account?" : "Reactivate account?"}
                  </h2>
                  <p id="user-status-description" className="mt-1.5 text-[13px] leading-5 text-slate-600">
                    {statusCandidate.isActive ? (
                      <>
                        Deactivating <span className="font-semibold text-slate-900">{statusCandidate.displayName}</span>&apos;s account prevents sign-in until it is reactivated.
                      </>
                    ) : (
                      <>
                        Reactivating <span className="font-semibold text-slate-900">{statusCandidate.displayName}</span>&apos;s account restores their access to SKonnect.
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setStatusCandidate(null)}
                  disabled={pendingUserId === statusCandidate.id}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={toggleUserStatus}
                  disabled={pendingUserId === statusCandidate.id}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${statusCandidate.isActive ? "bg-amber-700 hover:bg-amber-800" : "bg-emerald-700 hover:bg-emerald-800"}`}
                >
                  {pendingUserId === statusCandidate.id ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : statusCandidate.isActive ? (
                    <UserX className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle className="h-4 w-4" aria-hidden="true" />
                  )}
                  {pendingUserId === statusCandidate.id
                    ? "Updating..."
                    : statusCandidate.isActive ? "Deactivate account" : "Reactivate account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </>
  );
}
