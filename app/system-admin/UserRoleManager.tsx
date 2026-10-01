"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  Download,
  Eye,
  Filter,
  LoaderCircle,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";

type UserItem = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

type Props = {
  users: UserItem[];
};

type RoleFilter = "ALL" | Role;

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "YOUTH", label: "YOUTH" },
  { value: "GRANTEE", label: "GRANTEE" },
  { value: "SK_OFFICIAL", label: "SK_OFFICIAL" },
  { value: "SUPER_ADMIN", label: "SUPER_ADMIN" },
];

export default function UserRoleManager({ users }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [showRoleFilterMenu, setShowRoleFilterMenu] = useState(false);
  const [viewingUser, setViewingUser] = useState<UserItem | null>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [draftRoles, setDraftRoles] = useState<Record<string, Role>>(() =>
    Object.fromEntries(users.map((user) => [user.id, user.role])) as Record<string, Role>
  );
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

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
          body: JSON.stringify({ fullName: editFullName, email: editEmail }),
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

  function toggleUserStatus(user: UserItem) {
    const nextIsActive = !user.isActive;
    const action = nextIsActive ? "Reactivate" : "Deactivate";
    const confirmed = window.confirm(`${action} ${user.fullName}?`);
    if (!confirmed) return;

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
        router.refresh();
      } catch (error) {
        const text = error instanceof Error ? error.message : `Failed to ${action.toLowerCase()} user`;
        setMessage({ type: "error", text });
      } finally {
        setPendingUserId(null);
      }
    });
  }

  function deleteUser(user: UserItem) {
    const confirmed = window.confirm(`Delete ${user.fullName}? This cannot be undone.`);
    if (!confirmed) return;

    setPendingUserId(user.id);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/system-admin/users/${user.id}`, {
          method: "DELETE",
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || "Failed to delete user");
        }

        setMessage({ type: "success", text: "User deleted successfully." });
        router.refresh();
      } catch (error) {
        const text = error instanceof Error ? error.message : "Failed to delete user";
        setMessage({ type: "error", text });
      } finally {
        setPendingUserId(null);
      }
    });
  }

  return (
    <>
      {message ? (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
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
            className="inline-flex items-center gap-2 rounded-xl border border-[#CFDBE7] bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
            onClick={handleExportUsersExcel}
          >
            {isExporting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? "Exporting..." : "Export"}
          </button>
          <div className="hidden text-xs text-slate-500 sm:block">
            <span className="font-semibold text-slate-900 tabular-nums">{filteredUsers.length}</span> of{" "}
            <span className="tabular-nums">{users.length}</span>
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
            Total Accounts: {users.length}
          </span>
        </div>
        {filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-900 text-[11px] font-bold tracking-wider text-white uppercase">
                <tr className="text-left">
                  <th className="px-6 py-4">User / Email</th>
                  <th className="px-6 py-4">Current Role</th>
                  <th className="px-6 py-4">Account Status</th>
                  <th className="px-6 py-4">Joined Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => {
                  const draftRole = draftRoles[user.id] ?? user.role;
                  const busy = isPending && pendingUserId === user.id;
                  const initials = user.fullName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase();

                  return (
                    <tr key={user.id} className="transition hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                              {initials || "U"}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900">{user.fullName || "Unnamed User"}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Role for ${user.fullName}`}
                            value={draftRole}
                            onChange={(event) => updateRole(user.id, event.target.value as Role)}
                            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                            disabled={isPending}
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {busy ? <LoaderCircle className="h-4 w-4 animate-spin text-slate-500" aria-label="Updating role" /> : null}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${user.isActive ? "text-emerald-700" : "text-slate-500"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleUserStatus(user)}
                            disabled={busy}
                            className="text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-50"
                          >
                            {user.isActive ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs tabular-nums text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingUser(user)}
                            title={`View ${user.fullName}`}
                            aria-label={`View ${user.fullName}`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditUser(user)}
                            title={`Edit ${user.fullName}`}
                            aria-label={`Edit ${user.fullName}`}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteUser(user)}
                            title={`Delete ${user.fullName}`}
                            aria-label={`Delete ${user.fullName}`}
                            disabled={busy}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
          <div className="w-full max-w-md rounded-2xl border border-[#D6E1EC] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">User details</h3>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setViewingUser(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold text-slate-700">Name:</span> {viewingUser.fullName}</p>
              <p><span className="font-semibold text-slate-700">Email:</span> {viewingUser.email}</p>
              <p><span className="font-semibold text-slate-700">Role:</span> {viewingUser.role}</p>
              <p><span className="font-semibold text-slate-700">Status:</span> {viewingUser.isActive ? "ACTIVE" : "INACTIVE"}</p>
              <p><span className="font-semibold text-slate-700">Joined:</span> {new Date(viewingUser.createdAt).toLocaleString()}</p>
            </div>
          </div>
        </div>
      ) : null}

      {editingUser ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#D6E1EC] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Edit user</h3>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setEditingUser(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

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
    </>
  );
}
