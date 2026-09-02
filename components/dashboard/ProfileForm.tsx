"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import AvatarUploadField from "./AvatarUploadField";

export default function ProfileForm({
  displayName,
  bio,
  avatarUrl,
}: {
  displayName: string;
  bio: string;
  avatarUrl: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ displayName, bio, avatarUrl });
  const [submitting, setSubmitting] = useState(false);

  const dirty = form.displayName !== displayName || form.bio !== bio || form.avatarUrl !== avatarUrl;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      toast.success("Profile updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Profile Photo</label>
        <div className="mt-1.5">
          <AvatarUploadField
            value={form.avatarUrl}
            onChange={(url) => setForm({ ...form, avatarUrl: url })}
            displayName={form.displayName || displayName}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Display Name</label>
        <input
          required
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Bio</label>
        <textarea
          rows={3}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="A sentence or two about yourself — shown on your public author page."
          className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !dirty}
        className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-50"
      >
        {submitting ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
