"use client";

import { useRouter } from "next/navigation";

export default function DashboardLogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100"
    >
      Log Out
    </button>
  );
}
