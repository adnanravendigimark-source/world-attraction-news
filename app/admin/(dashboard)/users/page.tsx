import type { Metadata } from "next";
import { Suspense } from "react";
import { getUsers } from "@/lib/users";
import UsersTable from "@/components/admin/UsersTable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contributors & Users | World Attraction News Admin",
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading contributors...</div>}>
      <UsersTable initialUsers={users} />
    </Suspense>
  );
}
