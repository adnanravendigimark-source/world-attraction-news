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
      toast.success("Profile updated successfully.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
          Profile Photo
        </label>
        <AvatarUploadField
          value={form.avatarUrl}
          onChange={(url) => setForm({ ...form, avatarUrl: url })}
          displayName={form.displayName || displayName}
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
          Display Name (Byline) *
        </label>
        <input
          required
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          placeholder="Your full name"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
          Reporting Beat / Author Bio
        </label>
        <textarea
          rows={3}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="A short description of your attraction reporting background and destination beats..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all resize-none leading-relaxed"
        />
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[#DC2626] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
        >
          {submitting ? "Saving..." : "Save Profile Details"}
        </button>
      </div>
    </form>
  );
}
