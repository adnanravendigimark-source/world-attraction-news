"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"idle" | "verifying" | "done" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setStatus("verifying");
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Something went wrong.");
          setStatus("error");
        } else {
          setStatus("done");
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return (
      <p className="text-sm text-ink-600">
        This verification link is missing its token. If you just signed up, check your inbox for the email we sent
        — or{" "}
        <Link href="/signup" className="font-semibold text-signal hover:underline">
          apply again
        </Link>{" "}
        to get a new one.
      </p>
    );
  }

  if (status === "verifying" || status === "idle") {
    return <p className="text-sm text-ink-600">Verifying your email...</p>;
  }

  if (status === "error") {
    return (
      <div className="text-center">
        <p className="text-2xl">⚠️</p>
        <h2 className="mt-2 text-base font-bold text-ink-900">Couldn't verify your email</h2>
        <p className="mt-2 text-sm text-ink-600">{error}</p>
        <Link href="/signup" className="mt-4 inline-block text-sm font-semibold text-signal hover:underline">
          Apply again →
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-2xl">✅</p>
      <h2 className="mt-2 text-base font-bold text-ink-900">Email verified</h2>
      <p className="mt-2 text-sm text-ink-600">
        Thanks — your application is now with our editorial team for review. You'll get an email once there's a
        decision.
      </p>
      <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-signal hover:underline">
        Go to Log In →
      </Link>
    </div>
  );
}
