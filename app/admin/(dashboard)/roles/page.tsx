import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { getAllRoles, getRoleUserCounts, ADMIN_PAGES } from "@/lib/roles";
import { getUsers, toSafeUser } from "@/lib/users";
import RolesManager from "@/components/admin/RolesManager";
import AccessDenied from "@/components/admin/AccessDenied";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Roles & Permissions | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminRolesPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "roles", "read")) {
    return <AccessDenied pageLabel="Roles & Permissions" />;
  }

  const isOwnerAccount = session?.userId === "owner";
  const [roles, userCounts, users] = await Promise.all([getAllRoles(), getRoleUserCounts(), getUsers()]);
  // Only admin accounts can hold an Admin Panel role — contributors never
  // show up here. The env-based owner account isn't a row in `users` at
  // all (it always has unconditional full access), so it's excluded too.
  const admins = users.filter((u) => u.role === "admin").map(toSafeUser);

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Roles &amp; Permissions</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
          Create roles with page-by-page Read / Create / Update / Delete access, then assign them to admin accounts.
        </p>
      </div>

      <RolesManager
        initialRoles={roles}
        initialUserCounts={userCounts}
        pages={ADMIN_PAGES}
        admins={admins}
        currentUserId={session?.userId || ""}
        isOwnerAccount={isOwnerAccount}
        canCreateAdmins={effective === "full"}
      />
    </div>
  );
}
