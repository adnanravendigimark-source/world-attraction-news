import { sql } from "./db";

export type PermissionAction = "read" | "create" | "update" | "delete";

export interface PagePermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export type RolePermissions = Record<string, PagePermissions>;

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: RolePermissions;
  createdAt: string;
  updatedAt: string;
}

// Canonical list of every permission-gated Admin Panel page/resource. This
// is the single source of truth both the Roles & Permissions editor UI and
// every requireApiPermission() call site are built from — adding a new
// admin section later means adding one entry here, then wiring
// requireApiPermission()/hasPermission() into that section's route(s) and
// page.tsx (see lib/permissions.ts).
//
// Deliberately NOT listed here (never permission-gated): Overview (the
// landing dashboard every admin can see) and an admin's own account
// settings (changing your own password is always allowed, regardless of
// role — see app/api/admin/profile/password/route.ts).
export const ADMIN_PAGES: { key: string; label: string }[] = [
  { key: "articles", label: "Articles" },
  { key: "destinations", label: "Destinations" },
  { key: "categories", label: "Categories" },
  { key: "contributors", label: "Contributors" },
  { key: "subscribers", label: "Subscribers" },
  { key: "points", label: "Points Ledger" },
  { key: "indexing", label: "Indexing" },
  { key: "header", label: "Header" },
  { key: "footer", label: "Footer" },
  { key: "pages", label: "Pages" },
  { key: "activity", label: "Activity Log" },
  { key: "roles", label: "Roles & Permissions" },
];
export type AdminPageKey = (typeof ADMIN_PAGES)[number]["key"];
const VALID_PAGE_KEYS = new Set(ADMIN_PAGES.map((p) => p.key));

const EMPTY_PAGE_PERMISSIONS: PagePermissions = { read: false, create: false, update: false, delete: false };

// Always returns every known page key, defaulting anything missing/invalid
// in `raw` to all-false — a role can never accidentally grant access to a
// page it doesn't explicitly list, and a role saved before a new page
// existed just has that page fully closed rather than crashing.
export function normalizeRolePermissions(raw: any): RolePermissions {
  const result: RolePermissions = {};
  for (const page of ADMIN_PAGES) {
    const p = raw && typeof raw === "object" ? raw[page.key] : null;
    result[page.key] = {
      read: Boolean(p?.read),
      create: Boolean(p?.create),
      update: Boolean(p?.update),
      delete: Boolean(p?.delete),
    };
  }
  return result;
}

function rowToRole(row: any): Role {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    permissions: normalizeRolePermissions(row.permissions),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export async function getAllRoles(): Promise<Role[]> {
  try {
    const rows = await sql`SELECT * FROM roles ORDER BY name ASC`;
    return rows.map(rowToRole);
  } catch {
    return [];
  }
}

export async function getRoleById(id: string): Promise<Role | undefined> {
  const rows = await sql`SELECT * FROM roles WHERE id = ${id} LIMIT 1`;
  return rows.length ? rowToRole(rows[0]) : undefined;
}

export async function getRoleUserCounts(): Promise<Record<string, number>> {
  try {
    const rows = await sql`SELECT role_id, COUNT(*)::int AS n FROM users WHERE role_id IS NOT NULL GROUP BY role_id`;
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.role_id] = r.n;
    return counts;
  } catch {
    return {};
  }
}

export async function createRole(input: {
  name: string;
  description?: string;
  permissions: RolePermissions;
}): Promise<Role> {
  const name = input.name.trim();
  if (!name) throw new Error("Role name is required.");
  const existing = await sql`SELECT id FROM roles WHERE lower(name) = lower(${name}) LIMIT 1`;
  if (existing.length) throw new Error(`A role named "${name}" already exists.`);
  const permissions = normalizeRolePermissions(input.permissions);
  const rows = await sql`
    INSERT INTO roles (name, description, permissions)
    VALUES (${name}, ${input.description || ""}, ${JSON.stringify(permissions)})
    RETURNING *
  `;
  return rowToRole(rows[0]);
}

export async function updateRole(
  id: string,
  updates: { name?: string; description?: string; permissions?: RolePermissions }
): Promise<Role> {
  const current = await getRoleById(id);
  if (!current) throw new Error("Role not found.");
  const nextName = (updates.name ?? current.name).trim();
  if (!nextName) throw new Error("Role name is required.");
  if (nextName.toLowerCase() !== current.name.toLowerCase()) {
    const existing = await sql`SELECT id FROM roles WHERE lower(name) = lower(${nextName}) AND id != ${id} LIMIT 1`;
    if (existing.length) throw new Error(`A role named "${nextName}" already exists.`);
  }
  const nextDescription = updates.description ?? current.description;
  const nextPermissions = normalizeRolePermissions(updates.permissions ?? current.permissions);
  const rows = await sql`
    UPDATE roles
    SET name = ${nextName}, description = ${nextDescription}, permissions = ${JSON.stringify(nextPermissions)}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToRole(rows[0]);
}

export async function deleteRole(id: string): Promise<void> {
  // Same "block, don't silently strip" rule as deleteCity/deleteCategory —
  // a user with this role should never be silently promoted to unrestricted
  // access just because their role was deleted out from under them.
  const userRows = await sql`SELECT COUNT(*)::int AS count FROM users WHERE role_id = ${id}`;
  const count = userRows[0]?.count ?? 0;
  if (count > 0) {
    throw new Error(`Can't delete this role — ${count} user(s) are still assigned to it. Reassign them first.`);
  }
  await sql`DELETE FROM roles WHERE id = ${id}`;
}

export function isValidPageKey(key: string): key is AdminPageKey {
  return VALID_PAGE_KEYS.has(key);
}

export { EMPTY_PAGE_PERMISSIONS };
