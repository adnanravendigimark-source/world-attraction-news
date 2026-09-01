"use client";

import { useState } from "react";

export default function NewsletterForm({
  source,
  variant = "light",
}: {
  source: string;
  variant?: "light" | "dark";
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
      <p className={`text-sm font-semibold ${variant === "dark" ? "text-white" : "text-ink-900"}`}>
        You're subscribed — thanks for reading.
      </p>
    );
  }

  const inputClass =
    variant === "dark"
      ? "flex-1 rounded-md border border-ink-700 bg-ink-800 px-3.5 py-2.5 text-sm text-white placeholder:text-ink-400 focus:border-signal focus:outline-none"
      : "flex-1 rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 focus:border-signal focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
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
        placeholder="you@example.com"
        className={inputClass}
      />
      <button
        type="submit"
        disabled={status === "busy"}
        className="shrink-0 rounded-md bg-signal px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark disabled:opacity-60"
      >
        {status === "busy" ? "Subscribing…" : "Subscribe"}
      </button>
      {status === "error" && <p className="text-xs text-signal sm:basis-full">{error}</p>}
    </form>
  );
}
