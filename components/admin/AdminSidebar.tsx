"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  highlight?: boolean;
}

const DESK_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Desk Overview", icon: "home" },
  { href: "/admin/articles?status=pending", label: "Review Queue", icon: "inbox", highlight: true },
  { href: "/admin/articles", label: "Articles Master", icon: "doc" },
];

const CONTENT_NAV: AdminNavItem[] = [
  { href: "/admin/cities", label: "Destinations / Cities", icon: "pin" },
  { href: "/admin/attractions", label: "Landmarks / Venues", icon: "flag" },
  { href: "/admin/categories", label: "Beats / Categories", icon: "tag" },
  { href: "/admin/media", label: "Media Library", icon: "image" },
];

const NETWORK_NAV: AdminNavItem[] = [
  { href: "/admin/users", label: "Contributors & Roles", icon: "user" },
  { href: "/admin/points", label: "Quality Points Ledger", icon: "star" },
  { href: "/admin/newsletter", label: "Newsletter Audience", icon: "mail" },
];

const OPS_NAV: AdminNavItem[] = [
  { href: "/admin/seo", label: "SEO & Search Engine", icon: "search" },
  { href: "/admin/activity", label: "Audit & Activity Log", icon: "clock" },
  { href: "/admin/settings", label: "System Settings", icon: "gear" },
];

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "M3 11.5 12 4l9 7.5M5 10v9h5v-5h4v5h5v-9",
    inbox: "M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.375v4.875a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25v-4.875M2.25 13.5 4.5 4.5h15l2.25 9",
    doc: "M7 3h7l5 5v13H7zM14 3v5h5M9 12h6M9 16h6",
    pin: "M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    flag: "M5 21V4m0 0h13l-2.5 4L18 12H5",
    tag: "M20.5 12.5 12 21l-9-9L12 3h8.5v8.5ZM16 8h.01",
    image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
    star: "M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2L6.6 19.3l1.3-6L3.3 9.2l6.1-.6Z",
    mail: "M4 6h16v12H4zM4 7l8 6 8-6",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3.5 2",
    gear: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 13a7.4 7.4 0 0 0 .06-1 7.4 7.4 0 0 0-.06-1l2.1-1.6-2-3.5-2.5 1a7.5 7.5 0 0 0-1.7-1L14.9 3h-4l-.4 2.4a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.5L6.5 11a7.4 7.4 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.5 7.5 0 0 0 1.7 1l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 1.7-1l2.5 1 2-3.5-2.1-1.6Z",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || ""} />
    </svg>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStatus = searchParams?.get("status");
  const [open, setOpen] = useState(false);

  function isActive(item: AdminNavItem) {
    if (item.href === "/admin") return pathname === "/admin";
    if (item.href === "/admin/articles?status=pending") {
      return pathname === "/admin/articles" && currentStatus === "pending";
    }
    if (item.href === "/admin/articles") {
      return pathname === "/admin/articles" && !currentStatus;
    }
    return pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/admin");
  }

  const linkClass = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
      active
        ? "bg-signal text-white shadow-card font-semibold"
        : "text-ink-300 hover:bg-ink-900 hover:text-white"
    }`;

  const renderNavGroup = (title: string, items: AdminNavItem[]) => (
    <div className="space-y-1 mb-5">
      <p className="px-3 mb-1 text-[10px] font-mono font-bold uppercase tracking-widest text-ink-500">
        {title}
      </p>
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={linkClass(active)}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-900 px-3.5 py-2 text-xs font-bold text-ink-200 shadow-subtle lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        Admin CMS Menu
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-ink-950 p-5 shadow-2xl border-r border-ink-800">
            <div className="mb-4 flex items-center justify-between border-b border-ink-800 pb-3">
              <span className="font-serif text-sm font-black text-white">Editorial CMS</span>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-400 hover:text-white">
                ✕
              </button>
            </div>
            {renderNavGroup("Editorial Desk", DESK_NAV)}
            {renderNavGroup("Content & Taxonomy", CONTENT_NAV)}
            {renderNavGroup("Network & Audience", NETWORK_NAV)}
            {renderNavGroup("Operations", OPS_NAV)}
          </nav>
        </div>
      )}

      <nav className="hidden w-64 shrink-0 lg:block rounded-2xl border border-ink-800/80 bg-ink-950 p-4 shadow-card h-fit sticky top-24">
        {renderNavGroup("Editorial Desk", DESK_NAV)}
        {renderNavGroup("Content & Taxonomy", CONTENT_NAV)}
        {renderNavGroup("Network & Audience", NETWORK_NAV)}
        {renderNavGroup("Operations", OPS_NAV)}
      </nav>
    </>
  );
}
