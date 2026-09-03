"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ArticleWithRelations } from "@/lib/articles";
import type { ArticleRevision } from "@/lib/revisions";
import RichTextEditor from "@/components/RichTextEditor";
import ImageUploadField from "@/components/ImageUploadField";
import StatusBadge from "@/components/StatusBadge";
import ScoreBadge from "@/components/ScoreBadge";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatViews(n: number) {
  return n > 999 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

// Mirrors the exact status gates the API (app/api/admin/articles/[id]/route.ts)
// and lib/articles.ts enforce server-side — the UI only ever hides/disables
// what the backend would reject anyway, never invents a stricter rule of
// its own.
const REVIEWABLE_BLOCKLIST = new Set(["published", "scheduled", "unpublished"]);
const PUBLISHABLE_FROM = new Set(["approved", "unpublished", "scheduled"]);
const SCHEDULABLE_FROM = new Set(["approved", "unpublished"]);

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

function buildEditState(article: ArticleWithRelations): EditState {
  return {
    title: article.title || "",
    excerpt: article.excerpt || "",
    contentHtml: article.contentHtml || "",
    cityId: article.cityId || "",
    categoryId: article.categoryId,
    attractionId: article.attractionId,
    image: article.image || "",
    imageAlt: article.imageAlt || "",
    metaTitle: article.metaTitle || "",
    metaDescription: article.metaDescription || "",
    focusKeyword: article.focusKeyword || "",
    tags: (article.tags || []).join(", "),
    canonicalUrl: article.canonicalUrl || "",
    slug: article.slug || "",
  };
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

  const [mode, setMode] = useState<"review" | "edit">("review");
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState(article.score !== null ? String(article.score) : "");
  const [feedback, setFeedback] = useState(article.adminFeedback || "");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [showRevisions, setShowRevisions] = useState(false);
  const [edit, setEdit] = useState<EditState>(buildEditState(article));

  // Derived directly from the `article` prop on every render — never
  // copied into local state — so the moment router.refresh() re-fetches
  // the server component after an action, every gate and badge below
  // reflects the new status immediately with no stale local copy to fall
  // out of sync.
  const canReview = !REVIEWABLE_BLOCKLIST.has(article.status);
  const canPublish = PUBLISHABLE_FROM.has(article.status);
  const canSchedule = SCHEDULABLE_FROM.has(article.status);
  const canCancelSchedule = article.status === "scheduled";
  const canUnpublish = article.status === "published";
  const canDelete = article.status !== "published" && article.status !== "scheduled";

  function updateEdit<K extends keyof EditState>(key: K, value: EditState[K]) {
    setEdit((prev) => ({ ...prev, [key]: value }));
  }

  async function callApi(payload: Record<string, unknown>, successMessage: string): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      toast.success(successMessage);
      router.refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleStartReview() {
    await callApi({ action: "start_review" }, "Marked as under review — the contributor's been notified.");
  }

  async function handleReviewDecision(status: "approved" | "changes_requested" | "rejected") {
    if (status !== "approved" && !feedback.trim()) {
      toast.error("Add feedback so the contributor knows what to fix.");
      return;
    }
    const label = status === "approved" ? "Approved." : status === "rejected" ? "Rejected." : "Changes requested.";
    await callApi(
      { action: "review", status, score: score !== "" ? Number(score) : null, feedback: feedback.trim() },
      label
    );
  }

  async function handlePublish() {
    await callApi({ action: "publish" }, "Published to the public site.");
  }

  async function handleConfirmSchedule() {
    if (!scheduledAt) {
      toast.error("Choose a date and time.");
      return;
    }
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast.error("Choose a valid future date and time.");
      return;
    }
    const ok = await callApi({ action: "schedule", scheduledAt: when.toISOString() }, "Scheduled.");
    if (ok) setShowSchedule(false);
  }

  async function handleCancelSchedule() {
    await callApi({ action: "cancel_schedule" }, "Schedule cancelled.");
  }

  async function handleUnpublish() {
    const ok = await confirm({
      title: "Take this article off the public site?",
      description: "It stays intact and can be republished any time — this doesn't delete anything.",
      confirmLabel: "Unpublish",
      danger: true,
    });
    if (!ok) return;
    await callApi({ action: "unpublish" }, "Unpublished.");
  }

  async function handleRestoreRevision(revisionId: number) {
    const ok = await confirm({
      title: "Restore this revision?",
      description: "The article's title, excerpt, content, and image will be replaced with this saved version.",
      confirmLabel: "Restore Revision",
    });
    if (!ok) return;
    const success = await callApi({ action: "restore_revision", revisionId }, "Revision restored.");
    if (success) setEdit(buildEditState(article));
  }

  async function handleSaveEdit() {
    if (!edit.title.trim() || !edit.excerpt.trim() || !edit.contentHtml.trim()) {
      toast.error("Title, excerpt, and content can't be empty.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          title: edit.title,
          excerpt: edit.excerpt,
          contentHtml: edit.contentHtml,
          cityId: edit.cityId,
          categoryId: edit.categoryId,
          attractionId: edit.attractionId,
          image: edit.image,
          imageAlt: edit.imageAlt,
          metaTitle: edit.metaTitle,
          metaDescription: edit.metaDescription,
          focusKeyword: edit.focusKeyword,
          tags: edit.tags ? edit.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
          canonicalUrl: edit.canonicalUrl,
          slug: edit.slug,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed.");
      toast.success("Article updated.");
      setMode("review");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Permanently delete "${article.title || "this article"}"?`,
      description: "This can't be undone.",
      confirmLabel: "Delete Permanently",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      toast.success("Article deleted.");
      router.push("/admin/articles");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
      setBusy(false);
    }
  }

  const moderation = article.moderationSignals;
  const moderationWarnings: { label: string; detail: string }[] = moderation
    ? [
        moderation.duplicate?.flag
          ? {
              label: "Possible duplicate content",
              detail: moderation.duplicate.matches[0]
                ? `${Math.round(moderation.duplicate.matches[0].similarity * 100)}% similar to "${moderation.duplicate.matches[0].title}"`
                : "Overlaps with an existing article.",
            }
          : null,
        moderation.spam?.flag ? { label: "Possible spam", detail: moderation.spam.reasons.join(", ") } : null,
        moderation.inappropriate?.flag
          ? { label: "Possible inappropriate content", detail: moderation.inappropriate.reasons.join(", ") }
          : null,
        moderation.quality?.flag ? { label: "Quality concerns", detail: moderation.quality.reasons.join(", ") } : null,
        moderation.aiContent?.flag
          ? { label: "Possible AI-generated content", detail: moderation.aiContent.reasons.join(", ") }
          : null,
      ].filter((w): w is { label: string; detail: string } => w !== null)
    : [];

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/articles"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#DC2626] transition-colors mb-2"
          >
            ← Back to Articles
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {mode === "edit" ? "Edit Article" : article.title || "Untitled"}
            </h1>
            <StatusBadge status={article.status} size="md" />
          </div>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            By {article.authorName} ({article.authorEmail}) · {article.cityName || "Global"}
            {article.categoryName ? ` · ${article.categoryName}` : ""}
            {article.submittedAt ? ` · Submitted ${formatDate(article.submittedAt)}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {article.status === "published" && (
            <Link
              href={`/cities/${article.citySlug}/${article.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              Open Live Story ↗
            </Link>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (mode === "edit") setEdit(buildEditState(article));
              setMode(mode === "edit" ? "review" : "edit");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60"
          >
            {mode === "edit" ? "Cancel Edit" : "Edit Article"}
          </button>
        </div>
      </div>

      {mode === "edit" ? (
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Edit form — left column */}
          <div className="lg:col-span-8 space-y-5">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xs space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Article Title *</label>
                <input
                  type="text"
                  value={edit.title}
                  onChange={(e) => updateEdit("title", e.target.value)}
                  maxLength={100}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:border-[#DC2626] focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Slug (URL)</label>
                <input
                  type="text"
                  value={edit.slug}
                  onChange={(e) =>
                    updateEdit("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-mono text-slate-800 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Destination *</label>
                  <select
                    value={edit.cityId}
                    onChange={(e) => updateEdit("cityId", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-800 focus:border-[#DC2626] focus:outline-none"
                  >
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={edit.categoryId || ""}
                    onChange={(e) => updateEdit("categoryId", e.target.value || null)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-800 focus:border-[#DC2626] focus:outline-none"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Attraction</label>
                  <select
                    value={edit.attractionId || ""}
                    onChange={(e) => updateEdit("attractionId", e.target.value || null)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-800 focus:border-[#DC2626] focus:outline-none"
                  >
                    <option value="">None</option>
                    {attractions
                      .filter((a) => !edit.cityId || a.cityId === edit.cityId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Excerpt *</label>
                <textarea
                  rows={3}
                  value={edit.excerpt}
                  onChange={(e) => updateEdit("excerpt", e.target.value)}
                  maxLength={160}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Featured Image</label>
                {edit.image && (
                  <div className="relative aspect-[21/9] w-full mb-2 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <Image src={edit.image} alt={edit.imageAlt || ""} fill className="object-cover" />
                  </div>
                )}
                <ImageUploadField
                  label={edit.image ? "Replace featured image" : "Upload featured image (JPG, PNG, WebP)"}
                  value={edit.image}
                  onChange={(url) => updateEdit("image", url)}
                  uploadUrl="/api/upload"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Article Content *</label>
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white focus-within:border-[#DC2626]">
                  <RichTextEditor
                    value={edit.contentHtml}
                    onChange={(html) => updateEdit("contentHtml", html)}
                    placeholder="Article content..."
                    allowLinks
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Edit form — SEO sidebar */}
          <div className="lg:col-span-4 space-y-5">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">SEO &amp; Meta</h2>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">SEO Title</label>
                <input
                  type="text"
                  value={edit.metaTitle}
                  onChange={(e) => updateEdit("metaTitle", e.target.value)}
                  maxLength={60}
                  placeholder={edit.title}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Meta Description</label>
                <textarea
                  rows={3}
                  value={edit.metaDescription}
                  onChange={(e) => updateEdit("metaDescription", e.target.value)}
                  maxLength={160}
                  placeholder={edit.excerpt}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Focus Keyword</label>
                <input
                  type="text"
                  value={edit.focusKeyword}
                  onChange={(e) => updateEdit("focusKeyword", e.target.value)}
                  maxLength={60}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={edit.tags}
                  onChange={(e) => updateEdit("tags", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Canonical URL</label>
                <input
                  type="text"
                  value={edit.canonicalUrl}
                  onChange={(e) => updateEdit("canonicalUrl", e.target.value)}
                  placeholder="Defaults to this article's own URL"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700 focus:border-[#DC2626] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleSaveEdit}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#DC2626] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Article content — read-only, wide, easy to scan */}
          <div className="lg:col-span-8 space-y-5">
            {moderationWarnings.length > 0 && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-1.5">
                <p className="text-xs font-bold text-amber-900">⚠ Automated review flags — verify before approving</p>
                {moderationWarnings.map((w) => (
                  <p key={w.label} className="text-xs text-amber-800">
                    <span className="font-semibold">{w.label}:</span> {w.detail || "Flagged for manual review."}
                  </p>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-2xs space-y-6">
              {article.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={article.image}
                  alt={article.imageAlt || ""}
                  className="w-full max-h-[28rem] rounded-xl object-cover"
                />
              )}
              <div>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed italic border-l-2 border-slate-200 pl-3">
                  {article.excerpt}
                </p>
              </div>
              <div
                className="prose prose-slate max-w-none text-slate-800 text-sm sm:text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: article.contentHtml }}
              />
            </div>

            {/* Revision History */}
            {revisions.length > 0 && (
              <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRevisions(!showRevisions)}
                  className="flex w-full items-center justify-between p-4 sm:p-5 text-left cursor-pointer"
                >
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Revision History ({revisions.length})
                  </h2>
                  <span className="text-xs text-slate-400 font-bold">{showRevisions ? "▲" : "▼"}</span>
                </button>
                {showRevisions && (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {revisions.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 p-4 sm:px-5">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{r.changeSummary || "Edit"}</p>
                          <p className="text-[11px] text-slate-500">
                            {r.editorEmail} ({r.editorRole}) · {formatDateTime(r.createdAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRestoreRevision(r.id)}
                          className="shrink-0 text-xs font-bold text-[#DC2626] hover:underline cursor-pointer disabled:opacity-50"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Review sidebar */}
          <div className="lg:col-span-4 space-y-5">
            {/* Stats */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-lg font-extrabold text-slate-900">{formatViews(article.viewCount)}</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Views</p>
              </div>
              <div>
                <p className="text-lg font-extrabold text-slate-900">{article.wordCount.toLocaleString()}</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Words</p>
              </div>
              <div>
                <p className="text-lg font-extrabold text-slate-900">{article.readingTimeMinutes} min</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Reading Time</p>
              </div>
              <div>
                {article.score !== null ? (
                  <ScoreBadge score={article.score} size="md" />
                ) : (
                  <p className="text-lg font-extrabold text-slate-300">—</p>
                )}
                <p className="text-[10px] font-semibold text-slate-400 mt-1">Current Score</p>
              </div>
            </div>

            {/* Review Actions */}
            {canReview ? (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Review Decision</h2>
                  {article.status === "pending" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleStartReview}
                      className="text-[11px] font-bold text-slate-500 hover:text-[#DC2626] cursor-pointer disabled:opacity-50"
                    >
                      Mark Under Review
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Editorial Score (0–10)
                  </label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setScore(String(num))}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          score === String(num)
                            ? "bg-[#DC2626] text-white border-[#DC2626]"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                    Feedback for Contributor
                  </label>
                  <textarea
                    rows={4}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Required for Reject or Request Changes — explain what needs fixing."
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 focus:border-[#DC2626] focus:outline-none resize-none"
                  />
                  {article.reviewedAt && (
                    <p className="mt-1 text-[10px] text-slate-400">Last reviewed {formatDateTime(article.reviewedAt)}</p>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleReviewDecision("approved")}
                    className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-60"
                  >
                    ✓ Approve
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleReviewDecision("changes_requested")}
                      className="rounded-xl border border-amber-300 bg-amber-50 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-all cursor-pointer disabled:opacity-60"
                    >
                      Request Changes
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleReviewDecision("rejected")}
                      className="rounded-xl border border-rose-300 bg-rose-50 py-2 text-xs font-bold text-[#DC2626] hover:bg-rose-100 transition-all cursor-pointer disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50 p-5 text-xs text-slate-500">
                {article.status === "published"
                  ? "This article is live. Unpublish it to make review-status changes again."
                  : article.status === "scheduled"
                  ? "This article is scheduled. Cancel the schedule to make review-status changes again."
                  : "This article already went through publishing, so its review status is locked."}
                {article.adminFeedback && (
                  <p className="mt-2 text-slate-600">
                    <span className="font-semibold">Last feedback:</span> {article.adminFeedback}
                  </p>
                )}
              </div>
            )}

            {/* Publishing controls */}
            {(canPublish || canCancelSchedule || canUnpublish) && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Publishing</h2>

                {canPublish && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handlePublish}
                    className="w-full rounded-xl bg-[#DC2626] py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all cursor-pointer disabled:opacity-60"
                  >
                    Publish Now
                  </button>
                )}

                {canSchedule && !showSchedule && (
                  <button
                    type="button"
                    onClick={() => setShowSchedule(true)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Schedule for Later
                  </button>
                )}
                {showSchedule && (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleConfirmSchedule}
                        className="flex-1 rounded-lg bg-slate-900 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-60"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSchedule(false)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {canCancelSchedule && (
                  <div className="space-y-2">
                    {article.scheduledAt && (
                      <p className="text-[11px] text-slate-500">Scheduled for {formatDateTime(article.scheduledAt)}</p>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleCancelSchedule}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-60"
                    >
                      Cancel Schedule
                    </button>
                  </div>
                )}

                {canUnpublish && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleUnpublish}
                    className="w-full rounded-xl border border-rose-200 bg-rose-50/50 py-2 text-xs font-bold text-[#DC2626] hover:bg-rose-100/70 transition-all cursor-pointer disabled:opacity-60"
                  >
                    Unpublish
                  </button>
                )}
              </div>
            )}

            {/* Delete */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
              <button
                type="button"
                disabled={busy || !canDelete}
                onClick={handleDelete}
                title={canDelete ? undefined : "Unpublish (or cancel the schedule) before deleting a live article."}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
