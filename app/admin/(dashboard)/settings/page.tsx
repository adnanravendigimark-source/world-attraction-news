import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/users";
import { getCities } from "@/lib/cities";
import { getSettings } from "@/lib/settings";
import AdminProfileSettings from "@/components/admin/AdminProfileSettings";
import SiteSettingsForm from "@/components/admin/SiteSettingsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin Settings", robots: { index: false, follow: false } };

export default async function AdminSettingsPage() {
  const session = await getSession();
  const isOwnerAccount = session?.userId === "owner";
  const dbUser = isOwnerAccount || !session ? null : await findUserById(session.userId);

  const [settings, cities] = await Promise.all([getSettings(), getCities()]);

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink-900">Admin Settings</h1>
        <p className="mt-1 text-sm text-ink-600">Your admin profile and sitewide content defaults.</p>
      </div>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Admin Profile</h2>
        <div className="mt-3 rounded-lg border border-ink-200 bg-white p-6">
          <AdminProfileSettings
            email={session?.email || ""}
            isOwnerAccount={isOwnerAccount}
            hasPassword={isOwnerAccount ? true : Boolean(dbUser?.passwordHash)}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-700">Site Settings</h2>
        <div className="mt-3 rounded-lg border border-ink-200 bg-white p-6">
          <SiteSettingsForm initial={settings} cities={cities} />
        </div>
      </section>
    </div>
  );
}
