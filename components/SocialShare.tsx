"use client";

import { useState } from "react";

export default function SocialShare({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const links = [
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      icon: "M4 4l16 16M20 4L4 20",
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      icon: "M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H9v3h2v6h3v-6h3l1-3h-4V9c0-.6.4-1 1-1z",
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`,
      icon: "M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.7 8.7 0 0 1-4-1L3 20l1.2-4.9A8.4 8.4 0 1 1 21 11.5Z",
    },
    {
      label: "Email",
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
      icon: "M4 6h16v12H4zM4 7l8 6 8-6",
    },
  ];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently do nothing rather than error.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-500">Share</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share on ${l.label}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition-colors hover:border-signal hover:text-signal"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d={l.icon} />
          </svg>
        </a>
      ))}
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy link"
        className="flex h-8 items-center gap-1 rounded-full border border-ink-200 px-2.5 text-[11px] font-semibold text-ink-600 transition-colors hover:border-signal hover:text-signal"
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}
