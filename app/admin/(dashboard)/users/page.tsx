import type { Metadata } from "next";
import { Suspense } from "react";
import { getContributors } from "@/lib/users";
import UsersTable from "@/components/admin/UsersTable";
import AccessDenied from "@/components/admin/AccessDenied";
import { getSession } from "@/lib/session";
import { getEffectivePermissions, hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contributors & Users | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage() {
  const session = await getSession();
  const effective = await getEffectivePermissions(session);
  if (!hasPermission(effective, "contributors", "read")) {
    return <AccessDenied pageLabel="Contributors" />;
  }

  const users = await getContributors();

  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading contributors...</div>}>
      <UsersTable initialUsers={users} />
    </Suspense>
  );
}
