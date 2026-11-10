"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { Role, SubmissionStatus } from "@prisma/client";
import {
  Download,
  Eye,
  Filter,
  CheckCircle,
  ChevronDown,
  GraduationCap,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Search,
  UserX,
  X,
  XCircle,
  Clock3,
} from "lucide-react";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import { Avatar } from "@/components/ui/Avatar";

type UserItem = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  skeapStatus: SubmissionStatus | null;
  isActive: boolean;
  granteeStatus: "ACTIVE" | "PROBATIONARY" | "GRADUATED" | "REMOVED" | null;
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
  totalCount: number;
};

type RoleFilter = "ALL" | Role;

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "YOUTH", label: "YOUTH" },
  { value: "GRANTEE", label: "GRANTEE" },
  { value: "SK_OFFICIAL", label: "SK_OFFICIAL" },
  { value: "SUPER_ADMIN", label: "SUPER_ADMIN" },
];

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
    Icon:     XCircle,
    Clock3,
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

export default function UserRoleManager({ users, totalCount }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [showRoleFilterMenu, setShowRoleFilterMenu] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserItem | null>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [statusCandidate, setStatusCandidate] = useState<UserItem | null>(null);
  const [openActionsUserId, setOpenActionsUserId] = useState<string | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState({ top: 0, left: 0 });
  const actionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [draftRoles, setDraftRoles] = useState<Record<string, Role>>(() =>
    Object.fromEntries(users.map((user) => [user.id, user.role])) as Record<string, Role>
  );
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraftRoles(Object.fromEntries(users.map((user) => [user.id, user.role])) as Record<string, Role>);
  }, [users]);

  useEffect(() => {
    if (!openActionsUserId) return;

    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      if (!actionsMenuRef.current?.contains(target) && !actionsTriggerRef.current?.contains(target)) {
        setOpenActionsUserId(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenActionsUserId(null);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openActionsUserId]);

  useLayoutEffect(() => {
    if (!openActionsUserId) return;

    function updateMenuPosition() {
      const trigger = actionsTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = 192;
      const menuHeight = 150;
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

  const filteredUsers = useMemo(() => {
    const value = query.toLowerCase().trim();

    return users.filter((user) => {
      const matchesQuery =
        !value ||
        user.fullName.toLowerCase().includes(value) ||
        user.email.toLowerCase().includes(value);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [query, roleFilter, users]);

  function updateRole(userId: string, role: Role) {
    const user = users.find((item) => item.id === userId);
    if (!user || user.role === role || (isPending && pendingUserId !== userId)) return;

    setDraftRoles((prev) => ({ ...prev, [userId]: role }));
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
        setDraftRoles((prev) => ({ ...prev, [userId]: user.role }));
        const text = error instanceof Error ? error.message : "Failed to update role";
        setMessage({ type: "error", text });
      } finally {
        setPendingUserId(null);
      }
    });
  }

  function handleExportUsersExcel() {
    if (isExporting) return;
    if (filteredUsers.length === 0) {
      window.alert("No records found to export for the selected filter.");
      return;
    }

    const filterLabel = roleFilter === "ALL" ? "ALL_ROLES" : roleFilter.toUpperCase();
    const currentDate = new Date().toISOString().split("T")[0];
    const filename = `SKonnect_Users_${filterLabel}_${currentDate}.xlsx`;
    const exportStartedAt = performance.now();
    const finishAfterMinimumDuration = (complete: () => void) => {
      const remaining = Math.max(0, 1000 - (performance.now() - exportStartedAt));
      window.setTimeout(complete, remaining);
    };

    setIsExporting(true);
    setMessage(null);
    try {
      const worker = new Worker(new URL("./users-export.worker.ts", import.meta.url), {
        type: "module",
      });

      worker.onmessage = (event: MessageEvent<{ buffer?: ArrayBuffer; error?: string }>) => {
        worker.terminate();
        finishAfterMinimumDuration(() => {
          try {
            if (!event.data.buffer) {
              throw new Error(event.data.error || "Unable to generate the Excel workbook.");
            }

            const blob = new Blob([event.data.buffer], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = filename;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
          } catch (error) {
            setMessage({
              type: "error",
              text: error instanceof Error ? error.message : "Unable to export users.",
            });
          } finally {
            setIsExporting(false);
          }
        });
      };

      worker.onerror = () => {
        worker.terminate();
        finishAfterMinimumDuration(() => {
          setMessage({ type: "error", text: "Unable to generate the Excel workbook." });
          setIsExporting(false);
        });
      };

      worker.postMessage(filteredUsers);
    } catch (error) {
      finishAfterMinimumDuration(() => {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Unable to export users.",
        });
        setIsExporting(false);
      });
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

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="relative min-w-0 max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or email..."
            className="h-10 w-full rounded-xl border border-[#CFDBE7] bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B96C6] focus:ring-2 focus:ring-[#4B96C6]/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-[#CFDBE7] bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
              onClick={() => setShowRoleFilterMenu((prev) => !prev)}
            >
              <Filter className="h-4 w-4" />
              {roleFilter === "ALL" ? "All roles" : roleFilter}
            </button>
            {showRoleFilterMenu ? (
              <div className="absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-xl border border-[#D8E3EC] bg-white shadow-lg">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setRoleFilter("ALL");
                    setShowRoleFilterMenu(false);
                  }}
                >
                  All roles
                </button>
                {ROLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setRoleFilter(option.value);
                      setShowRoleFilterMenu(false);
                    }}
                  >
                    {option.value}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={isExporting}
            aria-busy={isExporting}
            aria-label="Export current filtered view"
            className="inline-flex items-center gap-2 rounded-xl border border-[#CFDBE7] bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
            onClick={handleExportUsersExcel}
          >
            {isExporting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? "Exporting..." : "Export Current View"}
          </button>
          <div className="hidden text-xs text-slate-500 sm:block">
            <span className="font-semibold text-slate-900 tabular-nums">{filteredUsers.length}</span> of{" "}
            <span className="tabular-nums">{users.length}</span> on this page
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-black text-slate-900">System Users &amp; Role Management</h2>
            <p className="mt-1 text-xs text-slate-500">
              Manage account access, assign RBAC roles, and control active user permissions.
            </p>
          </div>
          <span className="w-fit rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
            Total Accounts: {totalCount}
          </span>
        </div>
        {filteredUsers.length > 0 ? (
          <>
            <div className="hidden w-full overflow-x-auto whitespace-nowrap md:block">
            <table className="hidden w-full min-w-[1080px] text-sm md:table">
              <thead className="bg-slate-900 text-[11px] font-bold tracking-wider text-white uppercase">
                <tr className="text-left">
                  <th className="py-4 pl-[72px] pr-6">User / Email</th>
                  <th className="px-6 py-4">Current Role</th>
                  <th className="px-6 py-4">Account Status</th>
                  <th className="px-6 py-4">SKEAP Status</th>
                  <th className="px-6 py-4">Joined Date</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const draftRole = draftRoles[user.id] ?? user.role;
                  const busy = isPending && pendingUserId === user.id;
                  const scholarStatusBadge = user.skeapStatus === "WAITLISTED"
                    ? SCHOLAR_STATUS_BADGES.WAITLISTED
                    : user.granteeStatus
                      ? SCHOLAR_STATUS_BADGES[user.granteeStatus]
                    : null;
                  return (
                    <tr key={user.id} className="transition hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={user.avatarUrl}
                            alt={user.fullName || "User"}
                            size={36}
                            className="h-9 w-9"
                          />
                          <div>
                            <p className="font-bold text-slate-900">{user.fullName || "Unnamed User"}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="relative w-fit">
                            <select
                              aria-label={`Role for ${user.fullName}`}
                              value={draftRole}
                              onChange={(event) => updateRole(user.id, event.target.value as Role)}
                              className="h-9 w-[124px] appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                              disabled={isPending}
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              aria-hidden="true"
                              className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                            />
                          </div>
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-live="polite">
                            {busy ? (
                              <LoaderCircle className="h-4 w-4 animate-spin text-cyan-700" aria-label="Updating role" />
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-1.5 text-sm font-medium ${user.isActive ? "text-emerald-700" : "text-slate-500"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {user.isActive ? "Active" : "Inactive"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4 text-xs tabular-nums text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setOpenActionsUserId((current) => current === user.id ? null : user.id)}
                            title={`Actions for ${user.fullName}`}
                            aria-label={`Actions for ${user.fullName}`}
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
                              aria-label={`Actions for ${user.fullName}`}
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

            <div className="flex flex-col gap-4 p-4 md:hidden">
              {filteredUsers.map((user) => {
                const draftRole = draftRoles[user.id] ?? user.role;
                const busy = isPending && pendingUserId === user.id;
                const scholarStatusBadge = user.skeapStatus === "WAITLISTED"
                  ? SCHOLAR_STATUS_BADGES.WAITLISTED
                  : user.granteeStatus
                    ? SCHOLAR_STATUS_BADGES[user.granteeStatus]
                    : null;

                return (
                  <article
                    key={user.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        src={user.avatarUrl}
                        alt={user.fullName || "User"}
                        size={44}
                        className="h-11 w-11 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-bold text-slate-900">
                          {user.fullName || "Unnamed User"}
                        </h3>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                      <div className="min-w-0">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Current Role
                        </dt>
                        <dd className="relative mt-1">
                          <select
                            aria-label={`Role for ${user.fullName}`}
                            value={draftRole}
                            onChange={(event) => updateRole(user.id, event.target.value as Role)}
                            className="h-9 w-full appearance-none rounded-lg border border-slate-200 bg-white px-2 pr-8 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                            disabled={isPending}
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            aria-hidden="true"
                            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
                          />
                          {busy ? (
                            <LoaderCircle className="absolute right-7 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-cyan-700" aria-label="Updating role" />
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Account Status
                        </dt>
                        <dd className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium ${user.isActive ? "text-emerald-700" : "text-slate-500"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                          {user.isActive ? "Active" : "Inactive"}
                        </dd>
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
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-10">
            <p className="text-lg font-semibold text-slate-900">No users found.</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Once user profiles exist in the database, they will appear here automatically.
            </p>
          </div>
        )}
      </div>

      {viewingUser ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 px-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#D6E1EC] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  src={viewingUser.avatarUrl}
                  alt={viewingUser.fullName || "User"}
                  size={48}
                  className="h-12 w-12 shrink-0 bg-slate-100 text-slate-600"
                />
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-slate-900">
                    {viewingUser.fullName || "Unnamed User"}
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
                    {viewingUser.role}
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
              Update the user&apos;s name and contact details. Manage system role separately in the role selector.
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
                        Deactivating <span className="font-semibold text-slate-900">{statusCandidate.fullName}</span>&apos;s account prevents sign-in until it is reactivated.
                      </>
                    ) : (
                      <>
                        Reactivating <span className="font-semibold text-slate-900">{statusCandidate.fullName}</span>&apos;s account restores their access to SKonnect.
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
