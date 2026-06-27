"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  Check,
  ChevronDown,
  Download,
  Eye,
  Filter,
  MoreHorizontal,
  Pencil,
  Power,
  Search,
  Trash2,
  X,
} from "lucide-react";

type UserItem = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  updatedAt: string;
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
  const [openMenuUserId, setOpenMenuUserId] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<UserItem | null>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
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

  function updateRoleDraft(userId: string, role: Role) {
    setDraftRoles((prev) => ({ ...prev, [userId]: role }));
    setMessage(null);
  }

  function saveRole(userId: string) {
    const nextRole = draftRoles[userId];
    if (!nextRole) {
      setMessage({ type: "error", text: "Choose a role first." });
      return;
    }

    setPendingUserId(userId);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/system-admin/users/${userId}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: nextRole }),
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

  function exportCsv() {
    const headers = ["Full Name", "Email", "Role", "Active", "Updated At"];
    const rows = filteredUsers.map((user) => [
      user.fullName,
      user.email,
      user.role,
      user.isActive ? "ACTIVE" : "INACTIVE",
      new Date(user.updatedAt).toISOString(),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `system-admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openEditUser(user: UserItem) {
    setEditingUser(user);
    setEditFullName(user.fullName);
    setEditEmail(user.email);
    setOpenMenuUserId(null);
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

  function deactivateUser(user: UserItem) {
    if (!user.isActive) {
      setOpenMenuUserId(null);
      return;
    }

    const confirmed = window.confirm(`Deactivate ${user.fullName}?`);
    if (!confirmed) return;

    setPendingUserId(user.id);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/system-admin/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: false }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || "Failed to deactivate user");
        }

        setMessage({ type: "success", text: "User deactivated." });
        setOpenMenuUserId(null);
        router.refresh();
      } catch (error) {
        const text = error instanceof Error ? error.message : "Failed to deactivate user";
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
        setOpenMenuUserId(null);
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
            className="inline-flex items-center gap-2 rounded-xl border border-[#CFDBE7] bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
            onClick={exportCsv}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <div className="hidden text-xs text-slate-500 sm:block">
            <span className="font-semibold text-slate-900 tabular-nums">{filteredUsers.length}</span> of{" "}
            <span className="tabular-nums">{users.length}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => {
            const draftRole = draftRoles[user.id] ?? user.role;
            const busy = isPending && pendingUserId === user.id;
            const unchanged = draftRole === user.role;
            const initials = user.fullName
              .split(" ")
              .map((chunk) => chunk[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <article
                key={user.id}
                className="group relative overflow-hidden rounded-2xl border border-[#D6E1EC] bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0F3D5C] to-[#1E97D1] text-sm font-bold text-white">
                    {initials || "U"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{user.fullName}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          user.isActive ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Manage ${user.fullName}`}
                        title="Manage user"
                        onClick={() =>
                          setOpenMenuUserId((prev) => (prev === user.id ? null : user.id))
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {openMenuUserId === user.id ? (
                        <div className="absolute right-0 top-8 z-20 w-48 overflow-hidden rounded-xl border border-[#D8E3EC] bg-white shadow-lg">
                          <div className="border-b border-[#E8EEF5] px-3 py-2 text-xs font-semibold text-slate-700">
                            Manage user
                          </div>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                            onClick={() => {
                              setViewingUser(user);
                              setOpenMenuUserId(null);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            View details
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                            onClick={() => openEditUser(user)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit user
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => deactivateUser(user)}
                            disabled={!user.isActive || busy}
                          >
                            <Power className="h-4 w-4" />
                            Deactivate
                          </button>
                          <div className="border-t border-[#E8EEF5]" />
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                            onClick={() => deleteUser(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </header>

                <div className="mt-4 flex items-center gap-4 text-xs">
                  <div>
                    <p className="text-slate-500">Current role</p>
                    <span className="mt-1 inline-flex rounded-md border border-[#CDE0EE] bg-[#EDF5FB] px-2 py-0.5 text-[10px] font-semibold text-[#0F3D5C]">
                      {user.role}
                    </span>
                  </div>

                  <div className="h-8 w-px bg-[#DFE7EF]" />

                  <div>
                    <p className="text-slate-500">Updated</p>
                    <p className="mt-1 font-medium text-slate-900 tabular-nums">
                      {new Date(user.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-[#D8E3EC] bg-[#F8FBFE] p-3">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Assign role
                  </label>
                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <div className="relative min-w-0">
                      <select
                        value={draftRole}
                        onChange={(event) =>
                          updateRoleDraft(user.id, event.target.value as Role)
                        }
                        className="h-10 w-full min-w-0 appearance-none rounded-lg border border-[#CFDBE7] bg-white px-3 pr-10 text-sm font-medium outline-none transition focus:border-[#4B96C6] focus:ring-2 focus:ring-[#4B96C6]/20"
                        disabled={busy}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    </div>

                    <button
                      type="button"
                      onClick={() => saveRole(user.id)}
                      disabled={busy || unchanged}
                      className={`inline-flex min-w-[102px] items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition ${
                        busy || isPending
                          ? "bg-[#0F3D5C]/80 text-white"
                          : unchanged
                            ? "cursor-not-allowed bg-slate-200 text-slate-500"
                            : "bg-[#0F3D5C] text-white hover:opacity-95"
                      }`}
                    >
                      {busy ? (
                        "Saving..."
                      ) : unchanged ? (
                        "No change"
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-[#D6E1EC] bg-white p-10 shadow-sm">
            <p className="text-lg font-semibold text-[#0F3D5C]">No users found.</p>
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
              <p><span className="font-semibold text-slate-700">Updated:</span> {new Date(viewingUser.updatedAt).toLocaleString()}</p>
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
