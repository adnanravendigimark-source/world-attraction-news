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
  const [edit, setEdit] = useState<EditState>(toEditState(article));
  const [score, setScore] = useState(article.score !== null ? String(article.score) : "");
  const [feedback, setFeedback] = useState(article.adminFeedback);
  const [busy, setBusy] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocalDefault());
  const [showRevisions, setShowRevisions] = useState(false);
  const [showModeration, setShowModeration] = useState(false);

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
      toast.success("Marked as in active review.");
    } catch {}
  }

  async function handleReview(status: "approved" | "rejected" | "changes_requested") {
    const copy = {
      approved: {
        title: "Approve this article?",
        description: "This moves the article to approved status, making it ready to schedule or publish immediately.",
        label: "Approve Article",
      },
      rejected: {
        title: "Reject this article submission?",
        description: "The contributor will be notified that their submission was rejected.",
        label: "Reject Submission",
      },
      changes_requested: {
        title: "Request revisions from contributor?",
        description: "The contributor will receive your feedback notes and can update and resubmit.",
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
          ? "Article approved!"
          : status === "rejected"
          ? "Article rejected."
          : "Changes requested — author notified."
      );
    } catch {}
  }

  async function handlePublish() {
    const ok = await confirm({
      title: "Publish article live on World Attraction News?",
      description: "It will go live immediately on the public homepage and city destinations wire.",
      confirmLabel: "Publish Live Now",
    });
    if (!ok) return;
    try {
      await patch({ action: "publish" });
      toast.success("Article is now live on the site!");
    } catch {}
  }

  async function handleSchedule() {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast.error("Please choose a valid future release time.");
      return;
    }
    const ok = await confirm({
      title: "Schedule publication?",
      description: `The article will publish automatically on ${when.toLocaleString()}.`,
      confirmLabel: "Schedule Release",
    });
    if (!ok) return;
    try {
      await patch({ action: "schedule", scheduledAt: when.toISOString() });
      toast.success("Article scheduled for automated release.");
    } catch {}
  }

  async function handleCancelSchedule() {
    const ok = await confirm({
      title: "Cancel scheduled release?",
      description: "The article stays in approved status but will not auto-publish.",
      confirmLabel: "Cancel Schedule",
      danger: true,
    });
    if (!ok) return;
    try {
      await patch({ action: "cancel_schedule" });
      toast.success("Scheduled release cancelled.");
    } catch {}
  }

  async function handleUnpublish() {
    const ok = await confirm({
      title: "Unpublish this article?",
      description: "It will be taken down from the public site immediately.",
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
      title: "Restore this snapshot version?",
      description: `This will replace current content with the version saved on ${label}.`,
      confirmLabel: "Restore Snapshot",
      danger: true,
    });
    if (!ok) return;
    try {
      const saved = await patch({ action: "restore_revision", revisionId });
      setEdit(toEditState({ ...current, ...saved }));
      toast.success("Version restored successfully.");
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
      toast.success("Editorial edits saved.");
      router.refresh();
    } catch {}
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Permanently delete this article?",
      description: "This action cannot be undone.",
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
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Couldn't delete article.");
    }
  }

  if (current.status === "draft") {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/articles"
            className="text-xs font-semibold text-slate-500 hover:text-[#DC2626] transition-colors"
          >
            ← Back to Articles Queue
          </Link>
          <StatusBadge status={current.status} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-3">
          <h1 className="text-xl font-bold text-slate-900">{current.title || "Untitled Draft"}</h1>
          <p className="text-xs text-slate-500 font-medium">
            By {current.authorName} ({current.authorEmail}) · {current.cityName} Bureau
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed">
            This article is currently an unsubmitted draft in the author's private desk. It will enter the active review queue once submitted.
          </div>
          <div>
            <button
              disabled={busy}
              onClick={handleDelete}
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
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
    <div className="space-y-4">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/admin/articles"
            className="font-semibold text-slate-500 hover:text-[#DC2626] transition-colors"
          >
            ← Back to Queue
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600 font-medium hidden sm:inline">
            Verification &amp; Approval Desk
          </span>
        </div>

        <div className="flex items-center gap-2">
          {current.originalityFlag && (
            <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900">
              ⚠ Overlap Flag
            </span>
          )}
          <StatusBadge status={current.status} />

          {current.status === "published" && (
            <Link
              href={`/latest-news/${current.slug}`}
              target="_blank"
              className="rounded-lg bg-[#0B1527] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#DC2626] transition-colors"
            >
              Live Story ↗
            </Link>
          )}

          <button
            type="button"
            onClick={() => setEditMode(!editMode)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              editMode
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {editMode ? "Reading View" : "✎ Direct Edit"}
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Easy-to-Read Editorial Document (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {!editMode ? (
            /* Clean Magazine Reading Paper */
            <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-2xs space-y-6">
              {/* Category & Bureau Masthead */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">
                  {current.cityName || "Global"} Bureau
                </span>
                {current.categoryName && (
                  <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    {current.categoryName}
                  </span>
                )}
                {current.attractionName && (
                  <span className="text-xs text-slate-500 font-medium">
                    • {current.attractionName}
                  </span>
                )}
              </div>

              {/* Headline */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight">
                {current.title}
              </h1>

              {/* Author & Verification Meta Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-3 text-xs text-slate-600">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-[#0B1527] text-white flex items-center justify-center font-bold text-xs">
                    {current.authorName?.charAt(0)?.toUpperCase() || "W"}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 leading-none">{current.authorName}</p>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{current.authorEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
                  <span>📅 Submitted {formatDateTime(current.submittedAt || current.updatedAt)}</span>
                  <span>•</span>
                  <span>⏱ {current.readingTimeMinutes || 1} min read ({current.wordCount} words)</span>
                </div>
              </div>

              {/* Cover Photo */}
              {current.image && (
                <div className="space-y-1.5">
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    <Image
                      src={current.image}
                      alt={current.imageAlt || current.title}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                  {current.imageAlt && (
                    <p className="text-[11px] text-slate-500 italic px-1">
                      Photo: {current.imageAlt}
                    </p>
                  )}
                </div>
              )}

              {/* Lead Summary Excerpt */}
              {current.excerpt && (
                <div className="rounded-xl border-l-4 border-[#DC2626] bg-slate-50 p-4 text-base font-medium leading-relaxed text-slate-800 italic">
                  "{current.excerpt}"
                </div>
              )}

              {/* Formatted Article Body */}
              <div
                className="prose prose-slate prose-lg max-w-none text-slate-800 leading-relaxed pt-2 focus:outline-none"
                dangerouslySetInnerHTML={{ __html: current.contentHtml }}
              />

              {/* Article Footer Verification Details */}
              <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                <div>
                  Public Slug: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">/latest-news/{current.slug}</code>
                </div>
                <div>
                  Lifetime Views: <strong className="text-slate-900">{current.viewCount}</strong>
                </div>
              </div>
            </article>
          ) : (
            /* Direct Edit Form Mode */
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">DIRECT EDIT MODE</span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">Modify Article Fields</h2>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Headline</label>
                <input
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base font-bold text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Destination City</label>
                  <select
                    value={edit.cityId}
                    onChange={(e) => setEdit({ ...edit, cityId: e.target.value, attractionId: null })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
                  >
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Category Beat</label>
                  <select
                    value={edit.categoryId || ""}
                    onChange={(e) => setEdit({ ...edit, categoryId: e.target.value || null })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
                  >
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Summary / Excerpt</label>
                <textarea
                  rows={2}
                  value={edit.excerpt}
                  onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <ImageUploadField
                label="Cover Image"
                value={edit.image}
                onChange={(url) => setEdit({ ...edit, image: url })}
                uploadUrl="/api/admin/upload"
              />

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Article Body</label>
                <RichTextEditor
                  value={edit.contentHtml}
                  onChange={(html) => setEdit({ ...edit, contentHtml: html })}
                  uploadUrl="/api/admin/upload"
                />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
                <button
                  disabled={busy}
                  onClick={handleSaveEdit}
                  className="rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-all cursor-pointer"
                >
                  Save Editorial Changes
                </button>
                <button
                  onClick={() => {
                    setEdit(toEditState(current));
                    setEditMode(false);
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Review & Action Panel (4 cols, Sticky) */}
        <div className="lg:col-span-4 space-y-4 sticky top-14">
          {/* Card 1: Review Decision & Quality Score */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                DECISION CONSOLE
              </span>
              <h3 className="text-sm font-bold text-slate-900">Review &amp; Quality Scoring</h3>
            </div>

            {/* Quality Score 0 - 10 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase text-slate-700">
                  Score Rating (0 – 10)
                </label>
                {score && (
                  <span className="text-xs font-bold font-mono text-amber-700">
                    ★ {score} / 10
                  </span>
                )}
              </div>
              <div className="grid grid-cols-6 gap-1 mb-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setScore(String(num))}
                    className={`rounded py-1 text-xs font-bold transition-all cursor-pointer ${
                      score === String(num)
                        ? "bg-amber-600 text-white shadow-2xs font-bold"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback / Review Notes */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Editorial Review Notes
              </label>
              <textarea
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Notes or revision instructions for author..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {/* Decision Buttons */}
            {PUBLISH_PIPELINE_STATUSES.includes(current.status) ? (
              <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 text-xs font-semibold text-emerald-900">
                Article is currently <strong>{current.status.toUpperCase()}</strong>.
              </div>
            ) : (
              <div className="space-y-2 pt-1 border-t border-slate-100">
                {current.status === "pending" && (
                  <button
                    disabled={busy}
                    onClick={handleStartReview}
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    Start Active Review
                  </button>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={busy}
                    onClick={() => handleReview("approved")}
                    className="rounded-lg bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-800 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    ✓ Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleReview("changes_requested")}
                    className="rounded-lg border border-amber-300 bg-amber-50 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    ✎ Revise
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleReview("rejected")}
                    className="rounded-lg border border-rose-300 bg-rose-50 py-2.5 text-xs font-bold text-rose-900 hover:bg-rose-100 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Publishing & Distribution */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
            <div className="border-b border-slate-100 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">DISTRIBUTION</span>
              <h3 className="text-sm font-bold text-slate-900">Publishing Controls</h3>
            </div>

            {current.status === "published" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-2.5 text-xs font-bold text-emerald-900 border border-emerald-200">
                  <span>● Live on Global Wire</span>
                  <Link href={`/latest-news/${current.slug}`} target="_blank" className="underline">
                    View Live Story ↗
                  </Link>
                </div>
                <button
                  disabled={busy}
                  onClick={handleUnpublish}
                  className="w-full rounded-lg border border-rose-200 bg-rose-50 py-2 text-xs font-bold text-rose-900 hover:bg-rose-100 transition-all disabled:opacity-60 cursor-pointer"
                >
                  Unpublish Story
                </button>
              </div>
            )}

            {current.status === "scheduled" && (
              <div className="space-y-2.5">
                <p className="rounded-lg bg-purple-50 p-2.5 text-xs font-bold text-purple-900 border border-purple-200">
                  Scheduled for {formatDateTime(current.scheduledAt)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={busy}
                    onClick={handlePublish}
                    className="rounded-lg bg-slate-900 py-2 text-xs font-bold text-white hover:bg-[#DC2626] transition-all cursor-pointer"
                  >
                    Publish Now
                  </button>
                  <button
                    disabled={busy}
                    onClick={handleCancelSchedule}
                    className="rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {(current.status === "approved" || current.status === "unpublished") && (
              <div className="space-y-3">
                <button
                  disabled={busy}
                  onClick={handlePublish}
                  className="w-full rounded-lg bg-[#DC2626] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer"
                >
                  Publish Immediately →
                </button>
                <div className="border-t border-slate-100 pt-2.5">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Or Schedule for Automated Release
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-mono focus:outline-none"
                    />
                    <button
                      disabled={busy}
                      onClick={handleSchedule}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Schedule
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(current.status === "pending" || current.status === "under_review") && (
              <p className="text-xs text-slate-500 leading-relaxed">
                Approve this article above to unlock immediate live publishing and scheduling options.
              </p>
            )}

            {current.status === "rejected" && (
              <p className="text-xs text-slate-500 leading-relaxed">
                This submission was rejected. Publishing unlocks again only if the contributor edits and resubmits
                it for another review.
              </p>
            )}

            {current.status === "changes_requested" && (
              <p className="text-xs text-slate-500 leading-relaxed">
                Waiting on the contributor to address your feedback and resubmit. Publishing unlocks once you
                approve the resubmission.
              </p>
            )}
          </div>

          {/* Card 3: Featured Homepage Placements */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-2.5">
            <div className="border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Featured Placements</h4>
            </div>
            <div className="space-y-2">
              {(
                [
                  ["breaking", "Breaking News Banner"],
                  ["featured", "Hero Featured Spotlight"],
                  ["editorsPick", "Editor's Pick Section"],
                  ["trending", "Trending Story"],
                ] as const
              ).map(([key, label]) => {
                const value = current[key];
                return (
                  <label key={key} className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value}
                      disabled={busy}
                      onChange={(e) => handleEditorialFlag(key, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#DC2626] focus:ring-[#DC2626]"
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Card 4: Automated Verification Signals */}
          {moderation && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <button
                type="button"
                onClick={() => setShowModeration((v) => !v)}
                className="flex w-full items-center justify-between text-left cursor-pointer"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Automated Signals {moderationWarningCount > 0 && <span className="text-[#DC2626]">({moderationWarningCount})</span>}
                </h4>
                <span className="text-xs text-slate-400 font-bold">{showModeration ? "▲" : "▼"}</span>
              </button>

              {showModeration && (
                <div className="mt-3 space-y-2 text-xs pt-2 border-t border-slate-100">
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
                      className={`rounded-lg border p-2.5 ${
                        row.flag ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <span>{row.label}</span>
                        <span>{row.flag ? "⚠ Flagged" : "✓ Clear"}</span>
                      </div>
                      {row.reasons && row.reasons.length > 0 && (
                        <p className="mt-1 text-[10px] text-amber-800 leading-tight">
                          {row.reasons.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Card 5: Version Snapshots */}
          {revisions && revisions.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
              <button
                type="button"
                onClick={() => setShowRevisions((v) => !v)}
                className="flex w-full items-center justify-between text-left cursor-pointer"
              >
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Version History ({revisions.length})
                </h4>
                <span className="text-xs text-slate-400 font-bold">{showRevisions ? "▲" : "▼"}</span>
              </button>

              {showRevisions && (
                <div className="mt-3 space-y-2 pt-2 border-t border-slate-100">
                  {revisions.map((rev) => (
                    <div key={rev.id} className="flex items-center justify-between text-xs p-2 rounded bg-slate-50 border border-slate-200">
                      <div>
                        <p className="font-semibold text-slate-800">{rev.changeSummary || "Revision Snapshot"}</p>
                        <p className="text-[10px] text-slate-400">{formatDateTime(rev.createdAt)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreRevision(rev.id, formatDateTime(rev.createdAt))}
                        className="text-[11px] font-bold text-[#DC2626] hover:underline cursor-pointer"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Danger Zone: Delete Article */}
          <div className="pt-1">
            <button
              disabled={busy}
              onClick={handleDelete}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Permanently Delete Article
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
