import { NextResponse } from "next/server";
import type { Session } from "./auth";
import { findUserById } from "./users";
import { getRoleById, normalizeRolePermissions, type PermissionAction, type RolePermissions } from "./roles";

// "full" = unrestricted access to every page/action (the pre-RBAC default
// every admin had). A concrete RolePermissions map means the caller must
// check each page/action individually. This union is intentional: it lets
// getEffectivePermissions() short-circuit the common case (owner, or any
// admin who's never had a role assigned) without allocating a fake
// all-true permissions object.
export type EffectivePermissions = "full" | RolePermissions;

// The single place that decides what an already-authenticated admin
// session is allowed to do inside the Admin Panel. Deliberately re-reads
// the DB on every call rather than trusting anything baked into the
// session token — sessions are stateless/self-signed (see lib/auth.ts), so
// this is what makes "admin changes a role's permissions" or "admin
// reassigns someone's role" take effect on that user's very next request,
// with no re-login and no session invalidation required.
//
// Fails CLOSED on any anomaly (role_id points at a deleted role, DB error,
// user record missing, etc.) — an ambiguous state should never mean "grant
// access", it should mean "block until the data is fixed".
export async function getEffectivePermissions(session: Session | null): Promise<EffectivePermissions> {
  if (!session || session.role !== "admin") return normalizeRolePermissions({});

  // The env-based owner login always has full, unconditional access — it
  // isn't a row in `users` and can't be assigned a role.
  if (session.userId === "owner") return "full";

  try {
    const user = await findUserById(session.userId);
    if (!user || user.role !== "admin" || user.status === "suspended") return normalizeRolePermissions({});

    // No role assigned = unrestricted. This is what preserves 100% of
    // existing behavior for every admin that existed before RBAC shipped.
    if (!user.roleId) return "full";

    const role = await getRoleById(user.roleId);
    // role_id pointing at a role that no longer exists is a data-integrity
    // anomaly, not a green light — fail closed rather than silently
    // treating it as unrestricted.
    if (!role) return normalizeRolePermissions({});

    return role.permissions;
  } catch {
    return normalizeRolePermissions({});
  }
}

export function hasPermission(effective: EffectivePermissions, page: string, action: PermissionAction): boolean {
  if (effective === "full") return true;
  return Boolean(effective[page]?.[action]);
}

// One-liner every admin API route calls at the top of each handler in
// place of the old `session.role !== "admin"` check. Returns a ready-to-
// return 401/403 NextResponse when access should be denied, or null when
// the caller should proceed. Still checks session.role === "admin" itself
// so call sites don't need the old check at all.
export async function requireApiPermission(
  session: Session | null,
  page: string,
  action: PermissionAction
): Promise<NextResponse | null> {
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, page, action)) {
    return NextResponse.json(
      { error: `You don't have permission to ${action} ${page}.` },
      { status: 403 }
    );
  }
  return null;
}
