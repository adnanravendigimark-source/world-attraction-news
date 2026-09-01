"use client";

import { useRouter } from "next/navigation";

export default function AdminLogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/admin/login");
        router.refresh();
      }}
      className="rounded-md border border-ink-700 px-3 py-1.5 text-xs font-semibold text-ink-200 hover:bg-ink-800"
    >
      Log Out
    </button>
  );
}
