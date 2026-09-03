import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/users";
import ProfileForm from "@/components/dashboard/ProfileForm";
import PasswordForm from "@/components/dashboard/PasswordForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Profile Settings | World Attraction News",
  robots: { index: false, follow: false },
};

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
    <div className="max-w-3xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 text-xl shadow-2xs">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Profile Settings
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage your public profile, bio, and account credentials.
          </p>
        </div>
      </div>

      {/* Identity Card */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#0B1527] text-white flex items-center justify-center font-bold text-sm ring-2 ring-slate-200">
          {user.avatarUrl ? (
            <Image src={user.avatarUrl} alt="" fill className="object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-base">{user.displayName}</p>
          <p className="text-xs text-slate-500">{user.email}</p>
          <p className="mt-1 text-[11px] text-slate-400 font-medium">
            Contributor since {formatDate(user.createdAt)}
            {user.authProvider === "google" ? " · Signed up with Google" : ""}
          </p>
        </div>
      </div>

      {/* Public Profile Form Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">Public Profile</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Your name, avatar photo, and bio appear on your published articles.
          </p>
        </div>

        <ProfileForm displayName={user.displayName} bio={user.bio} avatarUrl={user.avatarUrl} />
      </div>

      {/* Security & Password Card */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">Security &amp; Password</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {user.authProvider === "google"
              ? "You sign in with Google. You can set a password if you would like to sign in with email as well."
              : "Update your password to keep your account secure."}
          </p>
        </div>

        <PasswordForm hasPassword={Boolean(user.passwordHash)} />
      </div>
    </div>
  );
}
