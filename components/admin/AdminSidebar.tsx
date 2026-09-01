"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Overview", icon: "home" },
  { href: "/admin/articles", label: "Articles", icon: "doc" },
  { href: "/admin/users", label: "Users", icon: "user" },
  { href: "/admin/points", label: "Points", icon: "star" },
  { href: "/admin/cities", label: "Cities", icon: "pin" },
  { href: "/admin/attractions", label: "Attractions", icon: "flag" },
  { href: "/admin/categories", label: "Categories", icon: "tag" },
  { href: "/admin/media", label: "Media", icon: "image" },
  { href: "/admin/newsletter", label: "Newsletter", icon: "mail" },
  { href: "/admin/seo", label: "SEO", icon: "search" },
  { href: "/admin/activity", label: "Activity", icon: "clock" },
  { href: "/admin/settings", label: "Settings", icon: "gear" },
] as const;

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "M3 11.5 12 4l9 7.5M5 10v9h5v-5h4v5h5v-9",
    doc: "M7 3h7l5 5v13H7zM14 3v5h5M9 12h6M9 16h6",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
    star: "M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2L6.6 19.3l1.3-6L3.3 9.2l6.1-.6Z",
    pin: "M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    tag: "M20.5 12.5 12 21l-9-9L12 3h8.5v8.5ZM16 8h.01",
    image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3.5 2",
    gear: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 13a7.4 7.4 0 0 0 .06-1 7.4 7.4 0 0 0-.06-1l2.1-1.6-2-3.5-2.5 1a7.5 7.5 0 0 0-1.7-1L14.9 3h-4l-.4 2.4a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.5L6.5 11a7.4 7.4 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.5 7.5 0 0 0 1.7 1l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 1.7-1l2.5 1 2-3.5-2.1-1.6Z",
    flag: "M5 21V4m0 0h13l-2.5 4L18 12H5",
    mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || ""} />
    </svg>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const linkClass = (active: boolean) =>
    `flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
      active ? "bg-signal text-white" : "text-ink-300 hover:bg-ink-800 hover:text-white"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 inline-flex items-center gap-2 rounded-md border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs font-semibold text-ink-200 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        Menu
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 w-64 space-y-1 overflow-y-auto bg-ink-900 p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-500">Admin Menu</span>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-400">
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

      <nav className="hidden w-52 shrink-0 space-y-1 lg:block">
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
