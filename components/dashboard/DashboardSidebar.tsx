"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "home" },
  { href: "/dashboard/articles", label: "My Articles", icon: "doc" },
  { href: "/dashboard/articles/new", label: "Write New Article", icon: "pencil" },
  { href: "/dashboard/points", label: "Points & Feedback", icon: "star" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "bell" },
  { href: "/dashboard/profile", label: "Profile & Account", icon: "user" },
] as const;

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "M3 11.5 12 4l9 7.5M5 10v9h5v-5h4v5h5v-9",
    doc: "M7 3h7l5 5v13H7zM14 3v5h5M9 12h6M9 16h6",
    pencil: "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3ZM14 6l4 4",
    star: "M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2L6.6 19.3l1.3-6L3.3 9.2l6.1-.6Z",
    bell: "M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 6.5H4.5C4.5 13.5 6 12 6 8Z M10 19a2 2 0 0 0 4 0",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || ""} />
    </svg>
  );
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/dashboard/articles") return pathname === "/dashboard/articles";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const linkClass = (active: boolean) =>
    `flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
      active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 inline-flex items-center gap-2 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        Menu
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 w-64 space-y-1 overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-400">Menu</span>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-500">
                ✕
              </button>
            </div>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={linkClass(isActive(item.href))}>
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <nav className="hidden w-56 shrink-0 space-y-1 lg:block">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(isActive(item.href))}>
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
