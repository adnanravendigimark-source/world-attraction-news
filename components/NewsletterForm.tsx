"use client";

import { useState } from "react";

export default function NewsletterForm({
  source,
  variant = "light",
  layout = "stacked",
  placeholder = "Enter your email address",
}: {
  source: string;
  variant?: "light" | "dark";
  layout?: "inline" | "stacked";
  placeholder?: string;
}) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("busy");
    setError("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setStatus("done");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
        <p className="text-xs font-semibold text-emerald-800">
          ✓ You&apos;re subscribed — thank you!
        </p>
      </div>
    );
  }

  const isStacked = layout === "stacked";

  const inputClass =
    variant === "dark"
      ? "w-full rounded-lg border border-ink-700 bg-ink-800 px-3.5 py-2.5 text-xs text-white placeholder:text-ink-400 focus:border-signal focus:outline-none shadow-2xs"
      : "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-ink-900 placeholder:text-gray-400 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal shadow-2xs";

  return (
    <form onSubmit={handleSubmit} className={isStacked ? "flex flex-col gap-2.5" : "flex flex-col gap-2 sm:flex-row"}>
      <input
        type="text"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      <button
        type="submit"
        disabled={status === "busy"}
        className={`w-full rounded-lg bg-signal px-4 py-2.5 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-signal-dark disabled:opacity-60 cursor-pointer ${
          !isStacked ? "sm:w-auto shrink-0" : ""
        }`}
      >
        {status === "busy" ? "Subscribing…" : "Subscribe"}
      </button>
      {status === "error" && <p className="text-xs text-signal">{error}</p>}
    </form>
  );
}
