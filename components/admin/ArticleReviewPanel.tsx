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
  tags: string; // comma-separated in the UI, split to string[] on save
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

// Statuses where the article has already been through some part of the
// publishing pipeline — review decisions (approve/reject/request changes)
// are disabled in the UI for these, matching the server-side guard in
// app/api/admin/articles/[id]/route.ts. Unpublish or cancel the schedule
// first to go back and change the review outcome.
const PUBLISH_PIPELINE_STATUSES = ["published", "scheduled", "unpublished"];

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// datetime-local input needs "YYYY-MM-DDTHH:mm" in local time.
function toDatetimeLocalDefault(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000); // default: 1 hour from now
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
      approved: { title: "Approve this article?", description: "It moves to the approved queue and becomes ready to schedule or publish.", label: "Approve" },
      rejected: { title: "Reject this article?", description: "The contributor will see it as rejected and cannot resubmit it.", label: "Reject" },
      changes_requested: {
        title: "Request changes on this article?",
        description: "The contributor will see your feedback and can edit and resubmit it.",
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
        status === "approved" ? "Article approved." : status === "rejected" ? "Article rejected." : "Changes requested — contributor notified."
      );
    } catch {
      // error toast already shown by patch()
    }
  }

  async function handlePublish() {
    const ok = await confirm({
      title: "Publish this article?",
      description: "It will go live on the public site immediately.",
      confirmLabel: "Publish",
    });
    if (!ok) return;
    try {
      await patch({ action: "publish" });
      toast.success("Article published.");
    } catch {}
  }

  async function handleSchedule() {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast.error("Choose a valid future date and time.");
      return;
    }
    const ok = await confirm({
      title: "Schedule this article?",
      description: `It will publish automatically on ${when.toLocaleString()}.`,
      confirmLabel: "Schedule",
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
      description: "The article stays approved but won't publish automatically.",
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
      description: "It will be removed from the public site immediately.",
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
      description: `This replaces the current title/body/image with the version from ${label}. The current version is itself saved as a new revision first, so nothing is lost.`,
      confirmLabel: "Restore",
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
      toast.success("Changes saved.");
      router.refresh();
    } catch {}
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "Permanently delete this article?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
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
      <div>
        <div className="mb-4 flex items-center justify-between">
          <Link href="/admin/articles" className="text-xs font-semibold text-ink-500 hover:text-ink-800">
            ← Back to Articles
          </Link>
          <StatusBadge status={current.status} />
        </div>
        <div className="rounded-lg border border-ink-200 bg-white p-6">
          <h1 className="font-serif text-xl font-bold text-ink-900">{current.title || "Untitled draft"}</h1>
          <p className="mt-1 text-xs text-ink-500">
            By {current.authorName} ({current.authorEmail}) · {current.cityName}
          </p>
          <p className="mt-4 rounded border border-ink-200 bg-ink-50 p-3 text-xs text-ink-600">
            This is a contributor's unsubmitted draft — it's still being written and hasn't entered the review queue
            yet. There's nothing to review or edit here until they submit it.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              disabled={busy}
              onClick={handleDelete}
              className="rounded-md border border-signal-border px-3 py-1.5 text-xs font-semibold text-signal hover:bg-signal-light disabled:opacity-60"
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
    ? [moderation.duplicate?.flag, moderation.spam?.flag, moderation.inappropriate?.flag, moderation.quality?.flag, moderation.aiContent?.flag].filter(
        Boolean
      ).length
    : 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin/articles" className="text-xs font-semibold text-ink-500 hover:text-ink-800">
          ← Back to Articles
        </Link>
        <div className="flex items-center gap-2">
          {current.originalityFlag && (
            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              Originality Flagged
            </span>
          )}
          <StatusBadge status={current.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-lg border border-ink-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h1 className="font-serif text-xl font-bold text-ink-900">{editMode ? "Edit Article" : current.title}</h1>
            {!editMode && (
              <div className="flex shrink-0 gap-3">
                <button onClick={() => setPreview((v) => !v)} className="text-xs font-semibold text-ink-600 hover:underline">
                  {preview ? "Details" : "Preview"}
                </button>
                <button onClick={() => setEditMode(true)} className="text-xs font-semibold text-signal hover:underline">
                  Edit
                </button>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-500">
            By{" "}
            {current.authorSlug ? (
              <Link href={`/author/${current.authorSlug}`} className="hover:underline" target="_blank">
                {current.authorName}
              </Link>
            ) : (
              current.authorName
            )}{" "}
            ({current.authorEmail}) · {current.cityName}
            {current.categoryName ? ` · ${current.categoryName}` : ""}
            {current.attractionName ? ` · ${current.attractionName}` : ""}
          </p>

          {!editMode && !preview && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded border border-ink-100 bg-ink-50 px-3 py-2 text-[11px] text-ink-500">
              <span>{current.wordCount} words</span>
              <span>{current.readingTimeMinutes || 1} min read</span>
              <span>Slug: /{current.slug}</span>
              <span>{current.viewCount} view{current.viewCount === 1 ? "" : "s"}</span>
              {current.tags.length > 0 && <span>Tags: {current.tags.join(", ")}</span>}
              {current.imageAlt && <span>Image alt: "{current.imageAlt}"</span>}
              {current.originalityScore !== null && (
                <span className={current.originalityFlag ? "font-semibold text-amber-700" : ""}>
                  Originality overlap: {Math.round(current.originalityScore * 100)}%
                </span>
              )}
            </div>
          )}

          {!editMode ? (
            <>
              {current.image && (
                <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-md border border-ink-100">
                  <Image src={current.image} alt={current.imageAlt || current.title} fill className="object-cover" />
                </div>
              )}
              <p className="mt-4 text-sm font-medium text-ink-700">{current.excerpt}</p>
              <div className="article-body mt-4 max-w-none" dangerouslySetInnerHTML={{ __html: current.contentHtml }} />

              {preview && (current.metaTitle || current.metaDescription || current.focusKeyword || current.canonicalUrl) && (
                <div className="mt-6 rounded border border-ink-200 bg-ink-50 p-3 text-xs text-ink-600">
                  <p className="font-semibold text-ink-800">SEO metadata</p>
                  {current.metaTitle && <p className="mt-1">Meta title: {current.metaTitle}</p>}
                  {current.metaDescription && <p className="mt-1">Meta description: {current.metaDescription}</p>}
                  {current.focusKeyword && <p className="mt-1">Focus keyword: {current.focusKeyword}</p>}
                  {current.canonicalUrl && <p className="mt-1">Canonical URL: {current.canonicalUrl}</p>}
                </div>
              )}
            </>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Title</label>
                <input
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">City</label>
                  <select
                    value={edit.cityId}
                    onChange={(e) => setEdit({ ...edit, cityId: e.target.value, attractionId: null })}
                    className="mt-1.5 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm"
                  >
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Category</label>
                  <select
                    value={edit.categoryId || ""}
                    onChange={(e) => setEdit({ ...edit, categoryId: e.target.value || null })}
                    className="mt-1.5 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Attraction (optional)</label>
                <select
                  value={edit.attractionId || ""}
                  onChange={(e) => setEdit({ ...edit, attractionId: e.target.value || null })}
                  className="mt-1.5 w-full max-w-xs rounded-md border border-ink-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Not attraction-specific</option>
                  {attractionsForCity.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Excerpt</label>
                <textarea
                  value={edit.excerpt}
                  onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })}
                  rows={2}
                  className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                />
              </div>
              <ImageUploadField
                label="Cover Image"
                value={edit.image}
                onChange={(url) => setEdit({ ...edit, image: url })}
                uploadUrl="/api/admin/upload"
              />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Cover Image Alt Text</label>
                <input
                  value={edit.imageAlt}
                  onChange={(e) => setEdit({ ...edit, imageAlt: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Body</label>
                <div className="mt-1.5">
                  <RichTextEditor
                    value={edit.contentHtml}
                    onChange={(html) => setEdit({ ...edit, contentHtml: html })}
                    uploadUrl="/api/admin/upload"
                  />
                </div>
              </div>

              <details className="rounded-md border border-ink-200 bg-ink-50 p-3" open>
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-500">
                  SEO &amp; Metadata
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-ink-500">URL Slug</label>
                    <input
                      value={edit.slug}
                      onChange={(e) => setEdit({ ...edit, slug: e.target.value })}
                      className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Tags (comma-separated)</label>
                    <input
                      value={edit.tags}
                      onChange={(e) => setEdit({ ...edit, tags: e.target.value })}
                      placeholder="e.g. tickets, theme-parks, family"
                      className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Meta Title</label>
                    <input
                      value={edit.metaTitle}
                      onChange={(e) => setEdit({ ...edit, metaTitle: e.target.value })}
                      className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Meta Description</label>
                    <input
                      value={edit.metaDescription}
                      onChange={(e) => setEdit({ ...edit, metaDescription: e.target.value })}
                      className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Focus Keyword</label>
                    <input
                      value={edit.focusKeyword}
                      onChange={(e) => setEdit({ ...edit, focusKeyword: e.target.value })}
                      className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink-500">Canonical URL (optional override)</label>
                    <input
                      value={edit.canonicalUrl}
                      onChange={(e) => setEdit({ ...edit, canonicalUrl: e.target.value })}
                      placeholder="Leave blank to use the default article URL"
                      className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </details>

              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={handleSaveEdit}
                  className="rounded-md bg-ink-900 px-4 py-2 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setEdit(toEditState(current));
                    setEditMode(false);
                  }}
                  className="rounded-md border border-ink-300 px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-bold text-ink-900">Review &amp; Score</h2>
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Score (0–10)</label>
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="mt-1.5 w-24 rounded-md border border-ink-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Feedback (optional)</label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
              />
            </div>
            {PUBLISH_PIPELINE_STATUSES.includes(current.status) ? (
              <p className="mt-3 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                {current.status === "published" ? "Published ✓" : current.status === "scheduled" ? "Scheduled ✓" : "Unpublished"} — unpublish or
                cancel the schedule to change its review status.
              </p>
            ) : (
              <>
                {current.status === "pending" && (
                  <button
                    disabled={busy}
                    onClick={handleStartReview}
                    className="mt-3 rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                  >
                    Start Review
                  </button>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {current.status === "approved" ? (
                    <span className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">Approved ✓</span>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => handleReview("approved")}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Approve
                    </button>
                  )}
                  {current.status === "changes_requested" ? (
                    <span className="rounded-md bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800">Changes Requested</span>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => handleReview("changes_requested")}
                      className="rounded-md border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100 disabled:opacity-60"
                    >
                      Request Changes
                    </button>
                  )}
                  {current.status === "rejected" ? (
                    <span className="rounded-md bg-signal-light px-3 py-1.5 text-xs font-semibold text-signal-dark">Rejected</span>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={() => handleReview("rejected")}
                      className="rounded-md border border-signal-border bg-signal-light px-3 py-1.5 text-xs font-semibold text-signal-dark hover:bg-signal-border disabled:opacity-60"
                    >
                      Reject
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {moderation && (
            <div className="rounded-lg border border-ink-200 bg-white p-5">
              <button type="button" onClick={() => setShowModeration((v) => !v)} className="flex w-full items-center justify-between text-left">
                <h2 className="text-sm font-bold text-ink-900">
                  Moderation Signals {moderationWarningCount > 0 && <span className="text-amber-700">({moderationWarningCount})</span>}
                </h2>
                <span className="text-xs text-ink-400">{showModeration ? "Hide" : "Show"}</span>
              </button>
              <p className="mt-1 text-[11px] text-ink-400">
                Automated review signals only — always read the article yourself before deciding.
              </p>
              {showModeration && (
                <div className="mt-3 space-y-2 text-xs">
                  {[
                    { label: "Duplicate / similar content", flag: moderation.duplicate?.flag, reasons: moderation.duplicate?.matches?.map((m) => `Similar to "${m.title}" (${Math.round(m.similarity * 100)}%)`) },
                    { label: "Spam", flag: moderation.spam?.flag, reasons: moderation.spam?.reasons },
                    { label: "Inappropriate content", flag: moderation.inappropriate?.flag, reasons: moderation.inappropriate?.reasons },
                    { label: `Quality (score ${moderation.quality?.score ?? "—"}/100)`, flag: moderation.quality?.flag, reasons: moderation.quality?.reasons },
                    { label: `AI-content signal (${moderation.aiContent?.score ?? 0}/100)`, flag: moderation.aiContent?.flag, reasons: moderation.aiContent?.reasons },
                  ].map((row) => (
                    <div key={row.label} className={`rounded border px-2.5 py-2 ${row.flag ? "border-amber-200 bg-amber-50" : "border-ink-100 bg-ink-50"}`}>
                      <p className={`font-semibold ${row.flag ? "text-amber-800" : "text-ink-600"}`}>
                        {row.flag ? "⚠ " : "✓ "}
                        {row.label}
                      </p>
                      {row.reasons && row.reasons.length > 0 && (
                        <ul className="mt-1 list-disc pl-4 text-ink-500">
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

          <div className="rounded-lg border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-bold text-ink-900">Publishing</h2>
            <div className="mt-3 space-y-2">
              {current.status === "published" && (
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">Published ✓</span>
                  <button
                    disabled={busy}
                    onClick={handleUnpublish}
                    className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                  >
                    Unpublish
                  </button>
                </div>
              )}
              {current.status === "scheduled" && (
                <div className="space-y-2">
                  <p className="rounded-md bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-800">
                    Scheduled for {formatDateTime(current.scheduledAt)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy}
                      onClick={handlePublish}
                      className="rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
                    >
                      Publish Now
                    </button>
                    <button
                      disabled={busy}
                      onClick={handleCancelSchedule}
                      className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                    >
                      Cancel Schedule
                    </button>
                  </div>
                </div>
              )}
              {(current.status === "approved" || current.status === "unpublished") && (
                <div className="space-y-2">
                  <button
                    disabled={busy}
                    onClick={handlePublish}
                    className="rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
                  >
                    Publish Now
                  </button>
                  <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-2">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="rounded-md border border-ink-300 px-2 py-1.5 text-xs"
                    />
                    <button
                      disabled={busy}
                      onClick={handleSchedule}
                      className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                    >
                      Schedule
                    </button>
                  </div>
                </div>
              )}
              {(current.status === "pending" || current.status === "under_review") && (
                <p className="text-xs text-ink-500">Approve this article first to enable publishing.</p>
              )}
              {current.status === "rejected" && <p className="text-xs text-ink-500">This article was rejected and is waiting on the contributor.</p>}
              {current.status === "changes_requested" && (
                <p className="text-xs text-ink-500">Changes were requested — waiting on the contributor to edit and resubmit.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-bold text-ink-900">Editorial Placement</h2>
            <p className="mt-1 text-[11px] text-ink-400">Controls where this article appears on the homepage once published.</p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ["featured", "Featured"],
                  ["trending", "Trending"],
                  ["editorsPick", "Editor's Pick"],
                  ["breaking", "Breaking / Important"],
                ] as const
              ).map(([key, label]) => {
                const value = current[key];
                return (
                  <label key={key} className="flex items-center gap-2 text-xs text-ink-700">
                    <input
                      type="checkbox"
                      checked={value}
                      disabled={busy}
                      onChange={(e) => handleEditorialFlag(key, e.target.checked)}
                      className="h-4 w-4 rounded border-ink-300"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>

          {revisions.length > 0 && (
            <div className="rounded-lg border border-ink-200 bg-white p-5">
              <button type="button" onClick={() => setShowRevisions((v) => !v)} className="flex w-full items-center justify-between text-left">
                <h2 className="text-sm font-bold text-ink-900">Revision History ({revisions.length})</h2>
                <span className="text-xs text-ink-400">{showRevisions ? "Hide" : "Show"}</span>
              </button>
              {showRevisions && (
                <div className="mt-3 space-y-2">
                  {revisions.map((r) => (
                    <div key={r.id} className="rounded border border-ink-100 bg-ink-50 p-2.5 text-xs">
                      <p className="font-semibold text-ink-800">{r.changeSummary || "Saved"}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">
                        {r.editorEmail || "Unknown"} ({r.editorRole || "?"}) · {formatDateTime(r.createdAt)}
                      </p>
                      <button
                        disabled={busy}
                        onClick={() => handleRestoreRevision(r.id, formatDateTime(r.createdAt))}
                        className="mt-1.5 text-[11px] font-semibold text-signal hover:underline disabled:opacity-60"
                      >
                        Restore this version
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-bold text-ink-900">Danger Zone</h2>
            <button
              disabled={busy}
              onClick={handleDelete}
              className="mt-3 rounded-md border border-signal-border px-3 py-1.5 text-xs font-semibold text-signal hover:bg-signal-light disabled:opacity-60"
            >
              Delete Article Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
