"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ArticleWithRelations } from "@/lib/articles";
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

export default function ArticleReviewPanel({
  article,
  cities,
  categories,
}: {
  article: ArticleWithRelations;
  cities: { id: string; name: string }[];
  categories: { id: string; name: string }[];
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

  async function handleReview(status: "approved" | "rejected") {
    const ok = await confirm({
      title: status === "approved" ? "Approve this article?" : "Reject this article?",
      description:
        status === "approved"
          ? "It moves to the approved queue and becomes ready to publish."
          : "The contributor will see it as rejected and can revise it.",
      confirmLabel: status === "approved" ? "Approve" : "Reject",
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
      toast.success(status === "approved" ? "Article approved." : "Article rejected.");
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

  async function handleUnpublish() {
    const ok = await confirm({
      title: "Unpublish this article?",
      description: "It will be removed from the public site and moved back to approved.",
      confirmLabel: "Unpublish",
      danger: true,
    });
    if (!ok) return;
    try {
      await patch({ action: "unpublish" });
      toast.success("Article unpublished.");
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

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
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
            By {current.authorName} ({current.authorEmail}) · {current.cityName}
            {current.categoryName ? ` · ${current.categoryName}` : ""}
          </p>

          {!editMode && !preview && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded border border-ink-100 bg-ink-50 px-3 py-2 text-[11px] text-ink-500">
              <span>{current.wordCount} words</span>
              <span>{current.readingTimeMinutes || 1} min read</span>
              <span>Slug: /{current.slug}</span>
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
                    onChange={(e) => setEdit({ ...edit, cityId: e.target.value })}
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
            {current.status === "published" ? (
              // A live article's review status shouldn't be changed to
              // approved/rejected directly — that would silently desync
              // `status` from `published_at`. Unpublish first (in the
              // Publishing panel below), which cleanly moves it back to
              // "approved" and re-enables Approve/Reject here.
              <p className="mt-3 rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                Published ✓ — unpublish to change its review status.
              </p>
            ) : (
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
            )}
          </div>

          <div className="rounded-lg border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-bold text-ink-900">Publishing</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {current.status === "published" ? (
                <>
                  <span className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">Published ✓</span>
                  <button
                    disabled={busy}
                    onClick={handleUnpublish}
                    className="rounded-md border border-ink-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                  >
                    Unpublish
                  </button>
                </>
              ) : current.status === "approved" ? (
                <button
                  disabled={busy}
                  onClick={handlePublish}
                  className="rounded-md bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
                >
                  Publish
                </button>
              ) : current.status === "pending" ? (
                <p className="text-xs text-ink-500">Approve this article first to enable publishing.</p>
              ) : (
                <p className="text-xs text-ink-500">This article was rejected and is waiting on the contributor.</p>
              )}
            </div>
          </div>

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
