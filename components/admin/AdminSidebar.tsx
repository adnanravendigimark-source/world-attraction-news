"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

interface AdminNavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

interface AdminNavSection {
  label: string;
  items: AdminNavItem[];
}

// Grouped instead of one long flat list — related pages sit together so an
// admin scanning the sidebar can find "where's the thing for X" by section,
// not by reading all 11 labels every time.
function buildSections(pendingArticles: number, pendingContributors: number): AdminNavSection[] {
  return [
    {
      label: "",
      items: [{ href: "/admin/overview", label: "Overview", icon: "home" }],
    },
    {
      label: "Content",
      items: [
        { href: "/admin/articles", label: "Articles", icon: "doc", badge: pendingArticles },
        { href: "/admin/cities", label: "Destinations", icon: "pin" },
        { href: "/admin/attractions", label: "Attractions", icon: "flag" },
        { href: "/admin/categories", label: "Categories", icon: "tag" },
      ],
    },
    {
      label: "Community",
      items: [
        { href: "/admin/users", label: "Contributors", icon: "user", badge: pendingContributors },
        { href: "/admin/newsletter", label: "Subscribers", icon: "mail" },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: "/admin/points", label: "Points Ledger", icon: "star" },
        { href: "/admin/indexing", label: "Indexing", icon: "indexing" },
        { href: "/admin/seo", label: "SEO", icon: "seo" },
      ],
    },
    {
      label: "System",
      items: [{ href: "/admin/settings", label: "Settings", icon: "gear" }],
    },
  ];
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    doc: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    pin: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z",
    flag: "M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9",
    tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
    user: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    mail: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    star: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
    indexing: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    seo: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35 M8 11h6M11 8v6",
    gear: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || ""} />
    </svg>
  );
}

export default function AdminSidebar({
  pendingArticles = 0,
  pendingContributors = 0,
}: {
  pendingArticles?: number;
  pendingContributors?: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const sections = buildSections(pendingArticles, pendingContributors);

  function isItemActive(href: string) {
    if (href === "/admin/overview") return pathname === "/admin" || pathname === "/admin/overview";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Left Admin Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between border-r border-slate-200/90 bg-white p-3.5 text-slate-700 transition-all duration-200 md:translate-x-0 ${
          collapsed ? "w-18" : "w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="space-y-4 min-h-0 flex-1 overflow-y-auto">
          {/* Logo & Hamburger Header */}
          <div className="flex items-center justify-between px-1 pt-1 sticky top-0 bg-white pb-1">
            {!collapsed ? (
              <Link href="/admin/overview" className="flex items-center gap-2.5 min-w-0">
                <Logo variant="mark" className="h-7 w-auto shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold tracking-tight text-slate-900 truncate leading-tight">
                    World Attraction
                  </span>
                  <span className="text-[10px] font-bold text-[#DC2626] leading-none">
                    News Admin
                  </span>
                </div>
              </Link>
            ) : (
              <Link href="/admin/overview" className="mx-auto">
                <Logo variant="mark" className="h-7 w-auto" />
              </Link>
            )}

            {/* Hamburger Button */}
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileOpen(false);
                } else {
                  setCollapsed(!collapsed);
                }
              }}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer shrink-0 ${
                collapsed ? "mx-auto" : ""
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Navigation Sections */}
          <nav className="space-y-4">
            {sections.map((section, idx) => (
              <div key={section.label || `section-${idx}`} className="space-y-1">
                {section.label && !collapsed && (
                  <p className="px-3.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {section.label}
                  </p>
                )}
                {section.label && collapsed && <div className="mx-2 border-t border-slate-100" />}
                {section.items.map((item) => {
                  const active = isItemActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center rounded-xl py-2 text-xs font-semibold transition-all ${
                        collapsed ? "justify-center px-2" : "gap-3 px-3.5"
                      } ${
                        active
                          ? "bg-[#DC2626] text-white shadow-md font-bold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <NavIcon name={item.icon} />
                      {!collapsed && <span className="flex-1 min-w-0 truncate">{item.label}</span>}
                      {!!item.badge && item.badge > 0 && (
                        <span
                          className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold shrink-0 ${
                            active ? "bg-white/25 text-white" : "bg-[#DC2626] text-white"
                          }`}
                        >
                          {item.badge > 9 ? "9+" : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
