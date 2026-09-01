import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/users";
import ProfileForm from "@/components/dashboard/ProfileForm";
import PasswordForm from "@/components/dashboard/PasswordForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile & Account Settings", robots: { index: false, follow: false } };

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await findUserById(session.userId);
  if (!user) redirect("/login");

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink-900">Profile & Account Settings</h1>
        <p className="mt-1 text-sm text-ink-600">
          {user.email} · Contributor since {formatDate(user.createdAt)}
          {user.authProvider === "google" ? " · Signed up with Google" : ""}
        </p>
      </div>

      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Public Profile</h2>
        <div className="mt-4">
          <ProfileForm displayName={user.displayName} bio={user.bio} />
        </div>
      </div>

      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Password</h2>
        <div className="mt-4">
          <PasswordForm hasPassword={Boolean(user.passwordHash)} />
        </div>
      </div>
    </div>
  );
}
