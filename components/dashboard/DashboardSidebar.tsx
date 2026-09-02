"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: string;
  filterStatus?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/dashboard/articles/new", label: "Write Dispatch", icon: "pencil" },
  { href: "/dashboard/articles", label: "All Dispatches", icon: "doc" },
];

const FILTER_NAV: NavItem[] = [
  { href: "/dashboard/articles?status=draft", label: "Drafts", icon: "draft", filterStatus: "draft" },
  { href: "/dashboard/articles?status=pending", label: "Under Review", icon: "clock", filterStatus: "pending" },
  { href: "/dashboard/articles?status=changes_requested", label: "Changes Requested", icon: "alert", filterStatus: "changes_requested" },
  { href: "/dashboard/articles?status=published", label: "Published", icon: "check", filterStatus: "published" },
];

const SECONDARY_NAV: NavItem[] = [
  { href: "/dashboard/points", label: "Points & Scores", icon: "star" },
  { href: "/dashboard/notifications", label: "Notifications", icon: "bell" },
  { href: "/dashboard/profile", label: "Author Profile", icon: "user" },
];

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "M3 11.5 12 4l9 7.5M5 10v9h5v-5h4v5h5v-9",
    doc: "M7 3h7l5 5v13H7zM14 3v5h5M9 12h6M9 16h6",
    pencil: "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3ZM14 6l4 4",
    draft: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
    clock: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    alert: "M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z",
    check: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    star: "M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2L6.6 19.3l1.3-6L3.3 9.2l6.1-.6Z",
    bell: "M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 6.5H4.5C4.5 13.5 6 12 6 8Z M10 19a2 2 0 0 0 4 0",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || ""} />
    </svg>
  );
}

export default function DashboardSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStatus = searchParams?.get("status");
  const [open, setOpen] = useState(false);

  function isItemActive(item: NavItem) {
    if (item.filterStatus) {
      return pathname === "/dashboard/articles" && currentStatus === item.filterStatus;
    }
    if (item.href === "/dashboard") return pathname === "/dashboard";
    if (item.href === "/dashboard/articles") return pathname === "/dashboard/articles" && !currentStatus;
    return pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard");
  }

  const linkClass = (active: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
      active
        ? "bg-ink-950 text-white shadow-card"
        : "text-ink-600 hover:bg-paper-200/80 hover:text-ink-950"
    }`;

  const renderNavGroup = (title: string | null, items: NavItem[]) => (
    <div className="space-y-1 mb-5">
      {title && (
        <p className="px-3 mb-1 text-[10px] font-mono font-bold uppercase tracking-widest text-ink-400">
          {title}
        </p>
      )}
      {items.map((item) => {
        const active = isItemActive(item);
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
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold text-ink-800 shadow-subtle lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        Workspace Menu
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-xs" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-ink-100 pb-3">
              <span className="font-serif text-sm font-black text-ink-900">Contributor Workspace</span>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-900">
                ✕
              </button>
            </div>
            {renderNavGroup("Navigation", PRIMARY_NAV)}
            {renderNavGroup("Pipeline", FILTER_NAV)}
            {renderNavGroup("Account", SECONDARY_NAV)}
          </nav>
        </div>
      )}

      <nav className="hidden w-60 shrink-0 lg:block rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card h-fit sticky top-24">
        {renderNavGroup(null, PRIMARY_NAV)}
        {renderNavGroup("Editorial Pipeline", FILTER_NAV)}
        {renderNavGroup("Account & Metrics", SECONDARY_NAV)}
      </nav>
    </>
  );
}
