"use client";

import { useState } from "react";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";
import type { Role, RolePermissions, PagePermissions } from "@/lib/roles";
import type { SafeUser } from "@/lib/users";

type AdminPage = { key: string; label: string };

const EMPTY_PERMS: PagePermissions = { read: false, create: false, update: false, delete: false };

function emptyPermissions(pages: AdminPage[]): RolePermissions {
  const result: RolePermissions = {};
  for (const p of pages) result[p.key] = { ...EMPTY_PERMS };
  return result;
}

function isPageEnabled(perm: PagePermissions | undefined): boolean {
  if (!perm) return false;
  return perm.read || perm.create || perm.update || perm.delete;
}

// How many of the four actions are turned on, for the compact summary shown
// on each role's card (e.g. "Articles: Read, Update" ) without needing to
// open the editor.
function enabledActionLabels(perm: PagePermissions | undefined): string {
  if (!perm) return "";
  const on: string[] = [];
  if (perm.read) on.push("Read");
  if (perm.create) on.push("Create");
  if (perm.update) on.push("Update");
  if (perm.delete) on.push("Delete");
  return on.join(", ");
}

interface RoleFormState {
  name: string;
  description: string;
  permissions: RolePermissions;
}

interface NewUserFormState {
  displayName: string;
  email: string;
  password: string;
  roleId: string;
}

const EMPTY_NEW_USER: NewUserFormState = { displayName: "", email: "", password: "", roleId: "" };

export default function RolesManager({
  initialRoles,
  initialUserCounts,
  pages,
  admins,
  currentUserId,
  isOwnerAccount,
  canCreateAdmins,
}: {
  initialRoles: Role[];
  initialUserCounts: Record<string, number>;
  pages: AdminPage[];
  admins: SafeUser[];
  currentUserId: string;
  isOwnerAccount: boolean;
  // Minting a brand-new admin account is only ever allowed for an already-
  // unrestricted admin/owner (see app/api/admin/users/route.ts) — this
  // just lets the UI show a helpful, disabled state instead of a failed
  // request for anyone else.
  canCreateAdmins: boolean;
}) {
  const confirm = useConfirm();
  const toast = useToast();

  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [userCounts, setUserCounts] = useState<Record<string, number>>(initialUserCounts);
  const [adminList, setAdminList] = useState<SafeUser[]>(admins);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleFormState>({ name: "", description: "", permissions: emptyPermissions(pages) });
  const [busy, setBusy] = useState(false);

  // Per-row "saving" state for the role-assignment table, keyed by user id,
  // so changing one admin's role doesn't disable every other row's select.
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState<NewUserFormState>(EMPTY_NEW_USER);

  function openAddModal() {
    setEditingId(null);
    setForm({ name: "", description: "", permissions: emptyPermissions(pages) });
    setModalOpen(true);
  }

  function openEditModal(role: Role) {
    setEditingId(role.id);
    setForm({ name: role.name, description: role.description, permissions: { ...role.permissions } });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  function togglePageEnabled(pageKey: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        // Turning a page ON grants Read by default (the least-surprising
        // starting point — a role for a page you can't even see is
        // meaningless); turning it OFF clears every action for that page.
        [pageKey]: checked ? { read: true, create: false, update: false, delete: false } : { ...EMPTY_PERMS },
      },
    }));
  }

  function toggleAction(pageKey: string, action: keyof PagePermissions, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [pageKey]: { ...(prev.permissions[pageKey] || EMPTY_PERMS), [action]: checked },
      },
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Please enter a role name.");
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/roles/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update role.");
        setRoles((prev) => prev.map((r) => (r.id === editingId ? data.role : r)));
        toast.success("Role updated — takes effect on every assigned admin's next request.");
      } else {
        const res = await fetch("/api/admin/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create role.");
        setRoles((prev) => [...prev, data.role].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Role created.");
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(role: Role) {
    const count = userCounts[role.id] || 0;
    if (count > 0) {
      toast.error(`Can't delete "${role.name}": ${count} admin(s) are still assigned to it. Reassign them first.`);
      return;
    }
    const ok = await confirm({
      title: `Delete "${role.name}"?`,
      description: "This permanently removes the role. This can't be undone.",
      confirmLabel: "Delete Role",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete role.");
      }
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      toast.success("Role deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete role.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignRole(userId: string, roleId: string) {
    setAssigning((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: roleId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role assignment.");

      const previousRoleId = adminList.find((u) => u.id === userId)?.roleId ?? null;
      setAdminList((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
      setUserCounts((prev) => {
        const next = { ...prev };
        if (previousRoleId) next[previousRoleId] = Math.max(0, (next[previousRoleId] || 1) - 1);
        if (roleId) next[roleId] = (next[roleId] || 0) + 1;
        return next;
      });
      toast.success("Role assignment updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update role assignment.");
    } finally {
      setAssigning((prev) => ({ ...prev, [userId]: false }));
    }
  }

  function openUserModal() {
    setNewUser(EMPTY_NEW_USER);
    setUserModalOpen(true);
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUser.displayName.trim() || !newUser.email.trim()) {
      toast.error("Please enter a name and email.");
      return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: newUser.displayName.trim(),
          email: newUser.email.trim(),
          password: newUser.password || undefined,
          roleId: newUser.roleId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user.");
      setAdminList((prev) => [data.user, ...prev]);
      if (newUser.roleId) {
        setUserCounts((prev) => ({ ...prev, [newUser.roleId]: (prev[newUser.roleId] || 0) + 1 }));
      }
      toast.success("Admin user created.");
      setUserModalOpen(false);
      setNewUser(EMPTY_NEW_USER);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creating user.");
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleToggleSuspend(user: SafeUser) {
    const isSuspended = user.status === "suspended";
    const nextStatus = isSuspended ? "approved" : "suspended";
    const actionLabel = isSuspended ? "Reactivate" : "Suspend";

    const ok = await confirm({
      title: `${actionLabel} ${user.displayName}?`,
      description: isSuspended
        ? "They will regain access to the Admin Panel with their assigned role."
        : "They will be immediately blocked from logging into the Admin Panel.",
      confirmLabel: `${actionLabel} Admin`,
      danger: !isSuspended,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${actionLabel.toLowerCase()} user.`);
      setAdminList((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)));
      toast.success(`Admin account ${isSuspended ? "reactivated" : "suspended"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${actionLabel.toLowerCase()} user.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteUser(user: SafeUser) {
    const ok = await confirm({
      title: `Delete ${user.displayName}?`,
      description: "This will permanently delete this admin account. This action cannot be undone.",
      confirmLabel: "Delete Admin",
      danger: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete user.");
      setAdminList((prev) => prev.filter((u) => u.id !== user.id));
      if (user.roleId) {
        setUserCounts((prev) => ({ ...prev, [user.roleId!]: Math.max(0, (prev[user.roleId!] || 1) - 1) }));
      }
      toast.success("Admin account deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 pb-24">
      {/* ============ ROLES ============ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">ROLES ({roles.length})</span>
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer"
          >
            + Create Role
          </button>
        </div>

        {roles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-400">
            No roles yet. Every admin currently has full, unrestricted access. Create a role to start restricting
            what specific admins can see and do.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => {
              const enabledPages = pages.filter((p) => isPageEnabled(role.permissions[p.key]));
              const count = userCounts[role.id] || 0;
              return (
                <div
                  key={role.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">{role.name}</h3>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 shrink-0">
                        {count} {count === 1 ? "admin" : "admins"}
                      </span>
                    </div>
                    {role.description && (
                      <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{role.description}</p>
                    )}
                    <div className="mt-3 space-y-1">
                      {enabledPages.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">No page access granted yet.</p>
                      ) : (
                        enabledPages.map((p) => (
                          <div key={p.key} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-semibold text-slate-700">{p.label}</span>
                            <span className="text-slate-400">{enabledActionLabels(role.permissions[p.key])}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => openEditModal(role)}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(role)}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ============ ASSIGN ROLES TO ADMINS ============ */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">ASSIGN ROLES TO ADMINS</span>
            <p className="mt-0.5 text-[11px] text-slate-500">
              An admin with no role has full, unrestricted access — exactly like before roles existed.
            </p>
          </div>
          <button
            type="button"
            onClick={openUserModal}
            disabled={!canCreateAdmins}
            title={canCreateAdmins ? undefined : "Only an unrestricted admin can create new admin accounts."}
            className="shrink-0 rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add User
          </button>
        </div>

        {adminList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-400">
            No admin accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminList.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isSuspended = user.status === "suspended";
                  return (
                    <tr key={user.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {user.displayName}
                          {isSelf && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-600">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={user.roleId || ""}
                          disabled={isSelf || assigning[user.id] || isSuspended}
                          onChange={(e) => handleAssignRole(user.id, e.target.value)}
                          title={isSelf ? "You can't change your own role assignment." : isSuspended ? "Unsuspend account to change role." : undefined}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <option value="">Unrestricted (Full Access)</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        {isSelf && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            {isOwnerAccount ? "Owner account — always full access." : "You can't edit your own role."}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isSelf ? (
                          <span className="text-[11px] text-slate-400 italic">Current user</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleToggleSuspend(user)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer ${
                                isSuspended
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                              }`}
                            >
                              {isSuspended ? "Reactivate" : "Suspend"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDeleteUser(user)}
                              className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ============ CREATE / EDIT ROLE MODAL ============ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={closeModal} />
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                  {editingId ? "EDIT ROLE" : "NEW ROLE"}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {editingId ? `Edit: ${form.name}` : "Create Role"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Role Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Content Editor"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Description
                  </label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional — what this role is for"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Page Access &amp; Permissions
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Check a page to grant access, then choose exactly which actions this role can perform on it.
                </p>
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {pages.map((page) => {
                    const perm = form.permissions[page.key] || EMPTY_PERMS;
                    const enabled = isPageEnabled(perm);
                    return (
                      <div key={page.key} className="flex flex-col gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => togglePageEnabled(page.key, e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-[#DC2626] focus:ring-[#DC2626]"
                          />
                          <span className="text-xs font-bold text-slate-800">{page.label}</span>
                        </label>
                        <div className="flex flex-wrap items-center gap-3 pl-5 sm:pl-0">
                          {(["read", "create", "update", "delete"] as const).map((action) => (
                            <label
                              key={action}
                              className={`flex items-center gap-1.5 cursor-pointer select-none ${
                                !enabled ? "opacity-40 cursor-not-allowed" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={!enabled}
                                checked={Boolean(perm[action])}
                                onChange={(e) => toggleAction(page.key, action, e.target.checked)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-[#DC2626] focus:ring-[#DC2626] disabled:cursor-not-allowed"
                              />
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                {action}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSave}
                className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
              >
                {busy ? "Saving..." : editingId ? "Save Changes" : "Create Role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ ADD USER MODAL ============ */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Add Admin User</h3>
                <p className="text-xs text-slate-500">
                  Creates a new admin account and assigns it a role. Contributors sign up on their own — this is
                  only for Admin Panel users.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Full Name <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="e.g. Marcus Vance"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-[#DC2626] focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Email Address <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="admin@worldattractionnews.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 focus:border-[#DC2626] focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Temporary Password (optional)</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Leave blank to auto-generate password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Role</label>
                <select
                  value={newUser.roleId}
                  onChange={(e) => setNewUser({ ...newUser, roleId: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#DC2626] focus:outline-none shadow-2xs cursor-pointer"
                >
                  <option value="">Unrestricted (Full Access)</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="rounded-xl bg-[#DC2626] px-5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {creatingUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
