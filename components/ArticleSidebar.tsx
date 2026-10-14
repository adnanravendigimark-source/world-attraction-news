"use client";

// The right-hand column on article pages (blog guides and travel news):
// newsletter signup, a list of related stories, trending stories and the
// "Have News to Share?" box. Lists are passed in ready to render, so each
// page decides what "related" means.

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export interface SidebarItem {
  id: string;
  title: string;
  href: string;
  image: string | null;
  eyebrow: string;
  date: string | null;
  readingMinutes?: number | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ArticleSidebar({
  related = [],
  trending = [],
  relatedTitle = "Related Stories",
}: {
  related?: SidebarItem[];
  trending?: SidebarItem[];
  relatedTitle?: string;
}) {
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");
  const [sidebarEmail, setSidebarEmail] = useState("");
  const [sidebarCompany, setSidebarCompany] = useState(""); // honeypot
  const displayRelated = related.slice(0, 4);
  const displayTrending = trending.slice(0, 5);

  async function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    setSubscribing(true);
    setSubscribeError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sidebarEmail, company: sidebarCompany, source: "article_sidebar" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setSubscribed(true);
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <div className="lg:col-span-4 flex flex-col gap-6">
      {/* Never Miss an Update Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-sans text-sm font-black text-[#0B1527]">
            Never Miss an Update
          </h3>
          <span className="text-xl">✉️</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          Subscribe to get the latest attraction news, opening dates, and updates straight to your inbox.
        </p>
    
        {subscribed ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl space-y-1 text-center">
            <p className="font-bold flex items-center justify-center gap-1.5 text-emerald-700">
              <span>✓</span>
              <span>You&apos;re subscribed to our dispatch wire!</span>
            </p>
            <p className="text-[11px] text-emerald-600">
              A welcome confirmation email has been sent to your inbox.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="flex flex-col gap-2.5">
            <input
              type="text"
              value={sidebarCompany}
              onChange={(e) => setSidebarCompany(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            <input
              type="email"
              required
              value={sidebarEmail}
              onChange={(e) => setSidebarEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all shadow-2xs"
            />
            <button
              type="submit"
              disabled={subscribing}
              className="w-full rounded-xl bg-[#DC2626] py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-2xs disabled:opacity-60 cursor-pointer"
            >
              {subscribing ? "SUBSCRIBING…" : "SUBSCRIBE"}
            </button>
            {subscribeError && (
              <p className="text-[11px] font-medium text-[#DC2626] text-center">{subscribeError}</p>
            )}
            <p className="text-[10px] text-slate-400 text-center">
              No spam. Unsubscribe anytime.
            </p>
          </form>
        )}
      </div>
    
      {/* Related Stories Card */}
      {displayRelated.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527] mb-4 pb-2 border-b border-slate-100">
            {relatedTitle}
          </h3>
          <div className="flex flex-col gap-4">
            {displayRelated.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="group flex items-start gap-3"
              >
                <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-lg overflow-hidden bg-slate-100">
                  {item.image && (
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="64px"
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#DC2626] block">
                    {item.eyebrow}
                  </span>
                  <h4 className="font-sans text-xs font-bold text-[#0B1527] line-clamp-2 leading-snug group-hover:text-[#DC2626] transition-colors mt-0.5">
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {formatDate(item.date)}{item.readingMinutes ? ` • ${item.readingMinutes} min read` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    
      {/* Trending Now Card */}
      {displayTrending.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-1.5 mb-4 pb-2 border-b border-slate-100">
            <span className="text-xs">📈</span>
            <h3 className="font-sans text-xs sm:text-sm font-black uppercase tracking-wider text-[#0B1527]">
              Trending Now
            </h3>
          </div>
    
          <div className="flex flex-col gap-3.5">
            {displayTrending.map((item, idx) => (
              <Link
                key={item.id}
                href={item.href}
                className="group flex items-center gap-3"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B1527] text-[10px] font-black text-white">
                  {idx + 1}
                </span>
                <div className="relative h-11 w-11 shrink-0 rounded-md overflow-hidden bg-slate-100">
                  {item.image && (
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="44px"
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-sans text-xs font-bold text-[#0B1527] line-clamp-1 leading-snug group-hover:text-[#DC2626] transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatDate(item.date)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    
      {/* Have News to Share? Dark Box */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0B1527] text-white p-6 shadow-md flex flex-col gap-3">
        <div className="absolute right-2 -bottom-2 opacity-15 pointer-events-none">
          <svg className="w-24 h-24 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
    
        <h3 className="font-serif text-lg font-black text-white">
          Have News to Share?
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed max-w-[260px]">
          Submit your attraction news, updates, or opening announcements.
        </p>
        <Link
          href="/write-for-us"
          className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#DC2626] py-2.5 px-4 text-xs font-black uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm self-start"
        >
          <span>SUBMIT YOUR NEWS</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
