import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/users";
import { getCities } from "@/lib/cities";
import { getSettings } from "@/lib/settings";
import AdminProfileSettings from "@/components/admin/AdminProfileSettings";
import SiteSettingsForm from "@/components/admin/SiteSettingsForm";
import SeoSettingsForm from "@/components/admin/SeoSettingsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings | World Attraction News Admin", robots: { index: false, follow: false } };

export default async function AdminSettingsPage() {
  const session = await getSession();
  const isOwnerAccount = session?.userId === "owner";
  const dbUser = isOwnerAccount || !session ? null : await findUserById(session.userId);

  const [settings, cities] = await Promise.all([getSettings(), getCities()]);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
          Your admin profile, general site defaults, and sitewide SEO fallbacks.
        </p>
      </div>

      <AdminProfileSettings
        email={session?.email || ""}
        isOwnerAccount={isOwnerAccount}
        hasPassword={isOwnerAccount ? true : Boolean(dbUser?.passwordHash)}
      />

      <SiteSettingsForm initial={settings} cities={cities} />

      <SeoSettingsForm initial={settings} />
    </div>
  );
}
