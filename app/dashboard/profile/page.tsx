import type { Metadata } from "next";
import Image from "next/image";
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

  const initials = user.displayName.trim().slice(0, 2).toUpperCase() || "?";

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink-900">Profile & Account Settings</h1>
        <p className="mt-1 text-sm text-ink-600">Manage how you appear to editors and readers, and how you sign in.</p>
      </div>

      {/* Identity summary card */}
      <div className="flex items-center gap-4 rounded-lg border border-ink-200 bg-white p-5">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white bg-ink-900 shadow-card ring-1 ring-ink-200">
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt="" width={64} height={64} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-serif text-lg font-bold text-white">
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-serif text-lg font-bold text-ink-900">{user.displayName}</p>
          <p className="truncate text-sm text-ink-500">{user.email}</p>
          <p className="mt-1 text-xs text-ink-400">
            Contributor since {formatDate(user.createdAt)}
            {user.authProvider === "google" ? " · Signed up with Google" : ""}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Public Profile</h2>
        <p className="mt-1 text-xs text-ink-500">
          Your photo, name, and bio appear on your byline and public author page.
        </p>
        <div className="mt-4">
          <ProfileForm displayName={user.displayName} bio={user.bio} avatarUrl={user.avatarUrl} />
        </div>
      </div>

      <div className="rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Password</h2>
        <p className="mt-1 text-xs text-ink-500">Used to sign in with your email address instead of Google.</p>
        <div className="mt-4">
          <PasswordForm hasPassword={Boolean(user.passwordHash)} />
        </div>
      </div>
    </div>
  );
}
