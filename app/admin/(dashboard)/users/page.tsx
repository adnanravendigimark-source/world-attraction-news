import type { Metadata } from "next";
import { Suspense } from "react";
import { getUsers } from "@/lib/users";
import UsersTable from "@/components/admin/UsersTable";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Users", robots: { index: false, follow: false } };

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink-900">Users</h1>
      <p className="mt-1 text-sm text-ink-600">
        Approve or reject registrations, and manage contributor/admin roles. Contributors aren't tied to a single
        city — they choose which city each article belongs to when they submit it.
      </p>
      <div className="mt-6">
        <Suspense fallback={null}>
          <UsersTable initialUsers={users} />
        </Suspense>
      </div>
    </div>
  );
}
