"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

const BASE_NAV_ITEMS: NavItem[] = [
  { href: "/contributor/dashboard", label: "Dashboard", icon: "home" },
  { href: "/contributor/articles/new", label: "Write Article", icon: "pencil" },
  { href: "/contributor/articles", label: "My Articles", icon: "doc" },
  { href: "/contributor/points", label: "Points & Scores", icon: "star" },
  { href: "/contributor/notifications", label: "Notifications", icon: "bell" },
  { href: "/contributor/profile", label: "Profile Settings", icon: "user" },
];

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    home: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    pencil: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    doc: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    star: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
    bell: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || ""} />
    </svg>
  );
}

export default function DashboardSidebar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const navItems = BASE_NAV_ITEMS.map((item) =>
    item.href === "/contributor/notifications" && unreadCount > 0 ? { ...item, badge: unreadCount } : item
  );

  const activeHref = navItems.reduce((best, item) => {
    const matches =
      item.href === "/contributor/dashboard"
        ? pathname === "/contributor/dashboard"
        : pathname === item.href || pathname.startsWith(item.href + "/");
    return matches && item.href.length > best.length ? item.href : best;
  }, "");

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Left Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col justify-between border-r border-slate-200/90 bg-white p-3.5 text-slate-700 transition-all duration-200 md:translate-x-0 ${
          collapsed ? "w-18" : "w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="space-y-5">
          {/* Logo & Hamburger Header */}
          <div className="flex items-center justify-between px-1 pt-1">
            {!collapsed && (
              <Link href="/" className="flex items-center gap-1.5 min-w-0">
                <span className="text-xl font-black text-[#DC2626]">A<span className="text-[#DC2626]">★</span></span>
                <span className="text-sm font-bold tracking-tight text-slate-900 truncate">
                  Attraction<span className="text-[#DC2626]"> News</span>
                </span>
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

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-xl py-2.5 text-xs font-semibold transition-all ${
                    collapsed ? "justify-center px-2" : "justify-between px-3.5"
                  } ${
                    active
                      ? "bg-[#DC2626] text-white shadow-md font-bold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <NavIcon name={item.icon} />
                    {!collapsed && <span>{item.label}</span>}
                  </div>
                  {!collapsed && item.badge && !active && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-50 text-[10px] font-bold text-[#DC2626] border border-rose-200">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Widget */}
        {!collapsed ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-xl text-[#DC2626]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Share Your Knowledge</h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Your stories inspire millions of travelers every day.
              </p>
            </div>
            <Link
              href="/contributor/articles/new"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#DC2626] py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#B91C1C] transition-all"
            >
              + WRITE NEW ARTICLE
            </Link>
          </div>
        ) : (
          <div className="flex justify-center pb-2">
            <Link
              href="/contributor/articles/new"
              title="Write New Article"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DC2626] text-white shadow-2xs hover:bg-[#B91C1C] transition-all"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
