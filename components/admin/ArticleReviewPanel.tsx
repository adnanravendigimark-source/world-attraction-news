"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ArticleWithRelations } from "@/lib/articles";
import type { ArticleRevision } from "@/lib/revisions";
import StatusBadge from "@/components/StatusBadge";
import RichTextEditor from "@/components/RichTextEditor";
import ImageUploadField from "@/components/ImageUploadField";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

interface EditState {
  title: string;
  excerpt: string;
  contentHtml: string;
  cityId: string;
  categoryId: string | null;
  attractionId: string | null;
  image: string;
  imageAlt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  tags: string;
  canonicalUrl: string;
  slug: string;
}

function toEditState(a: ArticleWithRelations): EditState {
  return {
    title: a.title,
    excerpt: a.excerpt,
    contentHtml: a.contentHtml,
    cityId: a.cityId,
    categoryId: a.categoryId,
    attractionId: a.attractionId,
    image: a.image,
    imageAlt: a.imageAlt,
    metaTitle: a.metaTitle,
    metaDescription: a.metaDescription,
    focusKeyword: a.focusKeyword,
    tags: a.tags.join(", "),
    canonicalUrl: a.canonicalUrl,
    slug: a.slug,
  };
}

const PUBLISH_PIPELINE_STATUSES = ["published", "scheduled", "unpublished"];

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDatetimeLocalDefault(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ArticleReviewPanel({
  article,
  cities,
  categories,
  attractions,
  revisions,
}: {
  article: ArticleWithRelations;
  cities: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  attractions: { id: string; name: string; cityId: string }[];
  revisions: ArticleRevision[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [current, setCurrent] = useState(article);
  const [editMode, setEditMode] = useState(false);
  const [preview, setPreview] = useState(false);
  const [edit, setEdit] = useState<EditState>(toEditState(article));
  const [score, setScore] = useState(article.score !== null ? String(article.score) : "");
  const [feedback, setFeedback] = useState(article.adminFeedback);
  const [busy, setBusy] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocalDefault());
  const [showRevisions, setShowRevisions] = useState(false);
  const [showModeration, setShowModeration] = useState(false);

  const attractionsForCity = attractions.filter((a) => a.cityId === edit.cityId);

  async function patch(body: any) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setCurrent((prev) => ({ ...prev, ...data.article }));
      return data.article;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function handleStartReview() {
    try {
      await patch({ action: "start_review" });
      toast.success("Marked as under review.");
    } catch {}
  }

  async function handleReview(status: "approved" | "rejected" | "changes_requested") {
    const copy = {
      approved: {
        title: "Approve this article?",
        description: "It moves to the approved queue and becomes ready to schedule or publish.",
        label: "Approve",
      },
      rejected: {
        title: "Reject this article?",
        description: "The contributor will see it as rejected.",
        label: "Reject",
      },
      changes_requested: {
        title: "Request changes on this article?",
        description: "The contributor will receive your feedback and can revise and resubmit.",
        label: "Request Changes",
      },
    }[status];

    const ok = await confirm({
      title: copy.title,
      description: copy.description,
      confirmLabel: copy.label,
      danger: status === "rejected",
    });
    if (!ok) return;

    try {
      await patch({
        action: "review",
        status,
        score: score === "" ? null : Number(score),
        feedback,
      });
      toast.success(
        status === "approved"
          ? "Article approved."
          : status === "rejected"
          ? "Article rejected."
          : "Changes requested — contributor notified."
      );
    } catch {}
  }

  async function handlePublish() {
    const ok = await confirm({
      title: "Publish this article immediately?",
      description: "It will go live on the public site and city feed.",
      confirmLabel: "Publish Now",
    });
    if (!ok) return;
    try {
      await patch({ action: "publish" });
      toast.success("Article is now live.");
    } catch {}
  }

  async function handleSchedule() {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast.error("Choose a valid future date and time.");
      return;
    }
    const ok = await confirm({
      title: "Schedule publication?",
      description: `It will publish automatically on ${when.toLocaleString()}.`,
      confirmLabel: "Schedule Dispatch",
    });
    if (!ok) return;
    try {
      await patch({ action: "schedule", scheduledAt: when.toISOString() });
      toast.success("Article scheduled.");
    } catch {}
  }

  async function handleCancelSchedule() {
    const ok = await confirm({
      title: "Cancel this scheduled publish?",
      description: "The article stays approved but will not auto-publish.",
      confirmLabel: "Cancel Schedule",
      danger: true,
    });
    if (!ok) return;
    try {
      await patch({ action: "cancel_schedule" });
      toast.success("Schedule cancelled.");
    } catch {}
  }

  async function handleUnpublish() {
    const ok = await confirm({
      title: "Unpublish this article?",
      description: "It will be immediately taken down from the public site.",
      confirmLabel: "Unpublish",
      danger: true,
    });
    if (!ok) return;
    try {
      await patch({ action: "unpublish" });
      toast.success("Article unpublished.");
    } catch {}
  }

  async function handleEditorialFlag(key: "featured" | "trending" | "editorsPick" | "breaking", value: boolean) {
    try {
      await patch({ action: "editorial_flags", [key]: value });
      toast.success("Editorial placement updated.");
    } catch {}
  }

  async function handleRestoreRevision(revisionId: number, label: string) {
    const ok = await confirm({
      title: "Restore this version?",
      description: `This replaces the current copy with the version from ${label}.`,
      confirmLabel: "Restore Version",
      danger: true,
    });
    if (!ok) return;
    try {
      const saved = await patch({ action: "restore_revision", revisionId });
      setEdit(toEditState({ ...current, ...saved }));
      toast.success("Version restored.");
      router.refresh();
    } catch {}
  }

  async function handleSaveEdit() {
    try {
      const saved = await patch({
        action: "edit",
        ...edit,
        tags: edit.tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      setEdit(toEditState({ ...current, ...saved }));
      setEditMode(false);
      toast.success("Editorial changes saved.");
      router.refresh();
    } catch {}
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Permanently delete this article?",
      description: "This cannot be undone.",
      confirmLabel: "Delete Permanently",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch(`/api/admin/articles/${article.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Article deleted.");
      router.push("/admin/articles");
      router.refresh();
    } else {
      setBusy(false);
      toast.error("Couldn't delete this article.");
    }
  }

  if (current.status === "draft") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/admin/articles" className="text-xs font-bold text-ink-500 hover:text-ink-900">
            ← Back to Articles Master
          </Link>
          <StatusBadge status={current.status} />
        </div>
        <div className="rounded-2xl border border-ink-200/80 bg-white p-8 shadow-card">
          <h1 className="font-serif text-2xl font-black text-ink-950">{current.title || "Untitled Draft"}</h1>
          <p className="mt-1 text-xs text-ink-500 font-mono">
            By {current.authorName} ({current.authorEmail}) · {current.cityName}
          </p>
          <div className="mt-6 rounded-xl border border-ink-200 bg-paper-100 p-4 text-xs text-ink-700 leading-relaxed">
            This is an unsubmitted draft currently in the contributor's private workspace. It enters the review queue once the contributor clicks Submit.
          </div>
          <div className="mt-6">
            <button
              disabled={busy}
              onClick={handleDelete}
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
            >
              Delete Draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  const moderation = current.moderationSignals;
  const moderationWarningCount = moderation
    ? [
        moderation.duplicate?.flag,
        moderation.spam?.flag,
        moderation.inappropriate?.flag,
        moderation.quality?.flag,
        moderation.aiContent?.flag,
      ].filter(Boolean).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-200/80 pb-4">
        <Link href="/admin/articles" className="text-xs font-bold text-ink-500 hover:text-ink-900 transition-colors">
          ← Back to Articles Queue
        </Link>
        <div className="flex items-center gap-2">
          {current.originalityFlag && (
            <span className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase text-amber-900">
              ⚠ Overlap Detected
            </span>
          )}
          <StatusBadge status={current.status} />
        </div>
      </div>

      {/* Main Review Workbench Layout */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Article Content / Editor */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border border-ink-200/80 bg-white p-6 sm:p-8 shadow-card">
            <div className="flex items-center justify-between gap-4 border-b border-ink-100 pb-4">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">
                  {editMode ? "Editorial Edit Mode" : "Dispatch Verification"}
                </p>
                <h1 className="font-serif text-2xl sm:text-3xl font-black text-ink-950 mt-1">
                  {editMode ? "Edit Dispatch Content" : current.title}
                </h1>
              </div>
              {!editMode && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreview((v) => !v)}
                    className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-paper-100"
                  >
                    {preview ? "Overview" : "Reader Preview"}
                  </button>
                  <button
                    onClick={() => setEditMode(true)}
                    className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-signal"
                  >
                    Direct Edit
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-mono text-ink-500 border-b border-ink-100 pb-4">
              <span>By <strong>{current.authorName}</strong> ({current.authorEmail})</span>
              <span>·</span>
              <span className="font-bold text-signal">{current.cityName} Bureau</span>
              {current.categoryName && <span>· Beat: {current.categoryName}</span>}
              {current.attractionName && <span>· Venue: {current.attractionName}</span>}
            </div>

            {!editMode && !preview && (
              <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-paper-100 p-3 text-[11px] font-mono text-ink-700">
                <div>Words: <strong className="text-ink-900">{current.wordCount}</strong></div>
                <div>Read Time: <strong className="text-ink-900">{current.readingTimeMinutes || 1} min</strong></div>
                <div>Views: <strong className="text-ink-900">{current.viewCount}</strong></div>
                <div>Slug: <strong className="text-ink-900 truncate block">/{current.slug}</strong></div>
              </div>
            )}

            {!editMode ? (
              <div className="space-y-6 mt-4">
                {current.image && (
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-ink-200">
                    <Image src={current.image} alt={current.imageAlt || current.title} fill className="object-cover" />
                  </div>
                )}
                {current.excerpt && (
                  <p className="font-serif text-base italic text-ink-700 border-l-2 border-signal pl-4 py-1 leading-relaxed">
                    {current.excerpt}
                  </p>
                )}
                <div className="article-body border-t border-ink-100 pt-6" dangerouslySetInnerHTML={{ __html: current.contentHtml }} />
              </div>
            ) : (
              <div className="space-y-5 mt-6">
                <div>
                  <label className="block text-xs font-bold uppercase text-ink-700 mb-1">Headline</label>
                  <input
                    value={edit.title}
                    onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                    className="w-full rounded-lg border border-ink-300 px-3.5 py-2 text-base font-bold text-ink-950 focus:border-signal focus:outline-none"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase text-ink-700 mb-1">Destination City</label>
                    <select
                      value={edit.cityId}
                      onChange={(e) => setEdit({ ...edit, cityId: e.target.value, attractionId: null })}
                      className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-semibold"
                    >
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-ink-700 mb-1">Category Beat</label>
                    <select
                      value={edit.categoryId || ""}
                      onChange={(e) => setEdit({ ...edit, categoryId: e.target.value || null })}
                      className="w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-xs font-semibold"
                    >
                      <option value="">None</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-ink-700 mb-1">Summary / Excerpt</label>
                  <textarea
                    rows={2}
                    value={edit.excerpt}
                    onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })}
                    className="w-full rounded-lg border border-ink-300 px-3 py-2 text-xs text-ink-800 focus:border-signal focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                <ImageUploadField
                  label="Cover Image"
                  value={edit.image}
                  onChange={(url) => setEdit({ ...edit, image: url })}
                  uploadUrl="/api/admin/upload"
                />

                <div>
                  <label className="block text-xs font-bold uppercase text-ink-700 mb-1">Body Copy</label>
                  <RichTextEditor
                    value={edit.contentHtml}
                    onChange={(html) => setEdit({ ...edit, contentHtml: html })}
                    uploadUrl="/api/admin/upload"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-ink-200">
                  <button
                    disabled={busy}
                    onClick={handleSaveEdit}
                    className="rounded-xl bg-ink-950 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-signal transition-all"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setEdit(toEditState(current));
                      setEditMode(false);
                    }}
                    className="rounded-xl border border-ink-300 px-4 py-2.5 text-xs font-bold text-ink-700 hover:bg-paper-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Review Action Console */}
        <div className="lg:col-span-4 space-y-6">
          {/* Review Decision Card */}
          <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card space-y-5">
            <div className="border-b border-ink-100 pb-3">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">
                Editorial Evaluation
              </p>
              <h3 className="font-serif text-lg font-black text-ink-950">Review &amp; Scoring</h3>
            </div>

            {/* Interactive 0-10 Score Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-2">
                Quality Score (0 – 10)
              </label>
              <div className="grid grid-cols-6 gap-1.5 mb-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setScore(String(num))}
                    className={`rounded-lg py-1.5 font-mono text-xs font-bold transition-all ${
                      score === String(num)
                        ? "bg-amber-600 text-white shadow-sm scale-105"
                        : "bg-paper-100 text-ink-700 hover:bg-paper-200"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                max={10}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="0-10"
                className="w-full rounded-lg border border-ink-200 bg-paper-50 px-3 py-1.5 text-xs font-mono font-bold focus:border-signal focus:outline-none"
              />
            </div>

            {/* Editorial Feedback */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1">
                Editor Notes / Feedback
              </label>
              <textarea
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Constructive feedback or change instructions for the author..."
                className="w-full rounded-lg border border-ink-200 bg-paper-50 p-3 text-xs text-ink-800 focus:border-signal focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Action Buttons */}
            {PUBLISH_PIPELINE_STATUSES.includes(current.status) ? (
              <div className="rounded-xl bg-emerald-50 p-3.5 border border-emerald-200 text-xs font-semibold text-emerald-900">
                Status: <strong>{current.status.toUpperCase()}</strong>. Unpublish to return to review decisions.
              </div>
            ) : (
              <div className="space-y-2 pt-2 border-t border-ink-100">
                {current.status === "pending" && (
                  <button
                    disabled={busy}
                    onClick={handleStartReview}
                    className="w-full rounded-xl border border-ink-300 bg-paper-100 py-2.5 text-xs font-bold text-ink-800 hover:bg-paper-200 transition-all disabled:opacity-60"
                  >
                    Start Active Review
                  </button>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={busy}
                    onClick={() => handleReview("approved")}
                    className="rounded-xl bg-emerald-700 py-2 text-xs font-bold text-white shadow-subtle hover:bg-emerald-800 transition-all disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleReview("changes_requested")}
                    className="rounded-xl border border-orange-300 bg-orange-50 py-2 text-xs font-bold text-orange-900 hover:bg-orange-100 transition-all disabled:opacity-60"
                  >
                    Revise
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleReview("rejected")}
                    className="rounded-xl border border-rose-300 bg-rose-50 py-2 text-xs font-bold text-rose-900 hover:bg-rose-100 transition-all disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Publishing Console */}
          <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card space-y-4">
            <div className="border-b border-ink-100 pb-3">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">Distribution</p>
              <h3 className="font-serif text-lg font-black text-ink-950">Publishing Controls</h3>
            </div>

            {current.status === "published" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-900 border border-emerald-200">
                  <span>● Live on Global Wire</span>
                  <Link href={`/cities/${current.citySlug}/${current.slug}`} target="_blank" className="underline">
                    View Live ↗
                  </Link>
                </div>
                <button
                  disabled={busy}
                  onClick={handleUnpublish}
                  className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2 text-xs font-bold text-rose-900 hover:bg-rose-100 transition-all disabled:opacity-60"
                >
                  Unpublish Dispatch
                </button>
              </div>
            )}

            {current.status === "scheduled" && (
              <div className="space-y-3">
                <p className="rounded-xl bg-purple-50 p-3 text-xs font-bold text-purple-900 border border-purple-200">
                  Scheduled for {formatDateTime(current.scheduledAt)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={busy}
                    onClick={handlePublish}
                    className="rounded-xl bg-ink-950 py-2 text-xs font-bold text-white hover:bg-signal transition-all"
                  >
                    Publish Now
                  </button>
                  <button
                    disabled={busy}
                    onClick={handleCancelSchedule}
                    className="rounded-xl border border-ink-300 py-2 text-xs font-bold text-ink-700 hover:bg-paper-100 transition-all"
                  >
                    Cancel Schedule
                  </button>
                </div>
              </div>
            )}

            {(current.status === "approved" || current.status === "unpublished") && (
              <div className="space-y-3">
                <button
                  disabled={busy}
                  onClick={handlePublish}
                  className="w-full rounded-xl bg-signal py-3 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark hover:shadow-lift transition-all"
                >
                  Publish Immediately →
                </button>
                <div className="border-t border-ink-100 pt-3">
                  <label className="block text-[10px] font-mono font-bold uppercase text-ink-500 mb-1">
                    Or Schedule for Future Release
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="flex-1 rounded-lg border border-ink-200 bg-paper-50 px-2 py-1.5 text-xs font-mono focus:outline-none"
                    />
                    <button
                      disabled={busy}
                      onClick={handleSchedule}
                      className="rounded-lg border border-ink-300 bg-white px-3 py-1.5 text-xs font-bold text-ink-800 hover:bg-paper-100 transition-all"
                    >
                      Schedule
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(current.status === "pending" || current.status === "under_review") && (
              <p className="text-xs text-ink-500 leading-relaxed">
                Approve this dispatch above to unlock live publishing &amp; scheduling controls.
              </p>
            )}
          </div>

          {/* Editorial Placement Flags */}
          <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card space-y-3">
            <div className="border-b border-ink-100 pb-2">
              <h4 className="font-serif text-sm font-black text-ink-950">Editorial Homepage Placement</h4>
            </div>
            <div className="space-y-2">
              {(
                [
                  ["breaking", "Breaking Wire Banner"],
                  ["featured", "Hero Featured Spotlight"],
                  ["editorsPick", "Editor's Pick Section"],
                  ["trending", "Trending Carousel"],
                ] as const
              ).map(([key, label]) => {
                const value = current[key];
                return (
                  <label key={key} className="flex items-center gap-2.5 text-xs font-semibold text-ink-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value}
                      disabled={busy}
                      onChange={(e) => handleEditorialFlag(key, e.target.checked)}
                      className="h-4 w-4 rounded border-ink-300 text-signal focus:ring-signal"
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Moderation Signals */}
          {moderation && (
            <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card">
              <button
                type="button"
                onClick={() => setShowModeration((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <h4 className="font-serif text-sm font-black text-ink-950">
                  Automated Signals {moderationWarningCount > 0 && <span className="text-signal">({moderationWarningCount})</span>}
                </h4>
                <span className="text-xs text-ink-400 font-bold">{showModeration ? "▲ Hide" : "▼ Details"}</span>
              </button>

              {showModeration && (
                <div className="mt-4 space-y-2 text-xs">
                  {[
                    {
                      label: "Content Similarity",
                      flag: moderation.duplicate?.flag,
                      reasons: moderation.duplicate?.matches?.map(
                        (m) => `Overlap with "${m.title}" (${Math.round(m.similarity * 100)}%)`
                      ),
                    },
                    { label: "Spam Verification", flag: moderation.spam?.flag, reasons: moderation.spam?.reasons },
                    { label: "Content Appropriateness", flag: moderation.inappropriate?.flag, reasons: moderation.inappropriate?.reasons },
                    { label: `Editorial Quality (${moderation.quality?.score ?? "—"}/100)`, flag: moderation.quality?.flag, reasons: moderation.quality?.reasons },
                    { label: `AI Attribution (${moderation.aiContent?.score ?? 0}/100)`, flag: moderation.aiContent?.flag, reasons: moderation.aiContent?.reasons },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className={`rounded-xl border p-3 ${
                        row.flag ? "border-amber-300 bg-amber-50 text-amber-900" : "border-ink-100 bg-paper-50 text-ink-700"
                      }`}
                    >
                      <p className="font-bold text-xs">{row.flag ? "⚠ " : "✓ "}{row.label}</p>
                      {row.reasons && row.reasons.length > 0 && (
                        <ul className="mt-1.5 list-disc pl-4 text-[11px] text-ink-600 space-y-0.5">
                          {row.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Revision History */}
          {revisions.length > 0 && (
            <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card">
              <button
                type="button"
                onClick={() => setShowRevisions((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <h4 className="font-serif text-sm font-black text-ink-950">Revision Diff History ({revisions.length})</h4>
                <span className="text-xs text-ink-400 font-bold">{showRevisions ? "▲ Hide" : "▼ Show"}</span>
              </button>
              {showRevisions && (
                <div className="mt-4 space-y-2.5">
                  {revisions.map((r) => (
                    <div key={r.id} className="rounded-xl border border-ink-100 bg-paper-50 p-3 text-xs">
                      <p className="font-bold text-ink-900">{r.changeSummary || "Saved changes"}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-400">
                        {r.editorEmail || "Editor"} · {formatDateTime(r.createdAt)}
                      </p>
                      <button
                        disabled={busy}
                        onClick={() => handleRestoreRevision(r.id, formatDateTime(r.createdAt))}
                        className="mt-2 text-xs font-bold text-signal hover:underline disabled:opacity-60"
                      >
                        Restore Version →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Delete Danger */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-5">
            <button
              disabled={busy}
              onClick={handleDelete}
              className="w-full rounded-xl border border-rose-300 bg-white py-2 text-xs font-bold text-rose-800 hover:bg-rose-50 transition-all disabled:opacity-60"
            >
              Delete Article Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
