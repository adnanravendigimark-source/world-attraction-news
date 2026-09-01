"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import ImageUploadField from "@/components/ImageUploadField";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

interface EditorValue {
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
}

const AUTOSAVE_DELAY_MS = 2500;

export default function ArticleEditor({
  articleId,
  initial,
  status,
  cities,
  categories,
}: {
  articleId?: string;
  initial?: Partial<EditorValue>;
  status?: string; // undefined for a brand-new article
  cities: { id: string; name: string; country: string }[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [id, setId] = useState<string | undefined>(articleId);
  const [currentStatus, setCurrentStatus] = useState<string | undefined>(status);
  const [form, setForm] = useState<EditorValue>({
    title: initial?.title || "",
    excerpt: initial?.excerpt || "",
    contentHtml: initial?.contentHtml || "",
    cityId: initial?.cityId || cities[0]?.id || "",
    categoryId: initial?.categoryId ?? null,
    image: initial?.image || "",
    imageAlt: initial?.imageAlt || "",
    metaTitle: initial?.metaTitle || "",
    metaDescription: initial?.metaDescription || "",
    focusKeyword: initial?.focusKeyword || "",
  });
  const [stats, setStats] = useState({ words: 0, characters: 0, readingTimeMinutes: 0 });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmFlag, setConfirmFlag] = useState<{ matches: { title: string; similarity: number }[] } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const dirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const idRef = useRef(id);
  idRef.current = id;

  const editable = !currentStatus || currentStatus === "draft" || currentStatus === "rejected";
  const plainTextLength = form.contentHtml.replace(/<[^>]*>/g, "").trim().length;

  const save = useCallback(async (value: EditorValue) => {
    if (!value.cityId) return; // wait for a city before ever saving
    setSaveState("saving");
    setSaveError("");
    try {
      if (!idRef.current) {
        if (!value.title.trim()) {
          setSaveState("idle");
          return;
        }
        const res = await fetch("/api/dashboard/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: value.title, cityId: value.cityId, categoryId: value.categoryId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't create draft.");
        idRef.current = data.article.id;
        setId(data.article.id);
        setCurrentStatus("draft");
      }
      const res = await fetch(`/api/dashboard/articles/${idRef.current}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save.");
      setCurrentStatus(data.article.status);
      setSaveState("saved");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save.");
      setSaveState("error");
    }
  }, []);

  // Debounced autosave — fires 2.5s after the last edit, only while the
  // article is still editable (draft, or rejected-and-being-fixed).
  useEffect(() => {
    if (!editable || !dirtyRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save(form);
      dirtyRef.current = false;
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function update(patch: Partial<EditorValue>) {
    dirtyRef.current = true;
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleManualSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    dirtyRef.current = false;
    await save(form);
  }

  async function handleSubmit(confirmDespiteFlag = false) {
    if (form.title.trim().length < 8) return toast.error("Title must be at least 8 characters.");
    if (!form.cityId) return toast.error("Select which city this article belongs to.");
    if (!form.excerpt.trim()) return toast.error("Add a short summary/excerpt.");
    if (plainTextLength < 200) return toast.error("Article body must contain at least 200 characters of written content.");
    if (!form.image) return toast.error("Upload a cover image.");

    if (!confirmDespiteFlag) {
      const ok = await confirm({
        title: currentStatus === "rejected" ? "Resubmit this article for review?" : "Submit this article for review?",
        description: "An editor will review it before it can be published.",
        confirmLabel: currentStatus === "rejected" ? "Resubmit" : "Submit",
      });
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      // Make sure the latest edits are saved before submitting.
      await save(form);
      if (!idRef.current) throw new Error("Couldn't save the article before submitting.");

      const res = await fetch(`/api/dashboard/articles/${idRef.current}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmDespiteFlag }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't submit.");

      if (data.needsConfirmation) {
        setConfirmFlag({ matches: data.originality?.matches || [] });
        setSubmitting(false);
        return;
      }

      toast.success("Article submitted for review.");
      router.push("/dashboard/articles");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  async function handleDeleteDraft() {
    if (!idRef.current) return;
    const ok = await confirm({
      title: "Discard this draft?",
      description: "This can't be undone.",
      confirmLabel: "Discard",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/articles/${idRef.current}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't delete draft.");
      }
      toast.success("Draft discarded.");
      router.push("/dashboard/articles");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete draft.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink-200 bg-white px-3 py-2 text-xs text-ink-500">
        <div className="flex items-center gap-3">
          <span>
            {stats.words} word{stats.words === 1 ? "" : "s"} · {stats.readingTimeMinutes || 1} min read
          </span>
          {currentStatus && currentStatus !== "draft" && (
            <span className="rounded bg-ink-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-ink-600">
              {currentStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saveState === "saving" && <span>Saving...</span>}
          {saveState === "saved" && <span className="text-emerald-700">Saved</span>}
          {saveState === "error" && <span className="text-signal">{saveError}</span>}
          {editable && (
            <button type="button" onClick={handleManualSave} className="font-semibold text-signal hover:underline">
              Save Draft
            </button>
          )}
          <button type="button" onClick={() => setPreview((v) => !v)} className="font-semibold text-ink-700 hover:underline">
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
      </div>

      {currentStatus === "rejected" && (
        <div className="rounded border border-signal-border bg-signal-light p-3 text-xs text-signal-dark">
          <span className="font-semibold">This article was rejected. </span>
          Editing and submitting again will resubmit it for review.
        </div>
      )}

      {confirmFlag && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">This looks similar to content already on the site.</p>
          <p className="mt-1.5 text-xs">
            Our originality check found overlap with{" "}
            {confirmFlag.matches.length ? confirmFlag.matches.map((m) => `"${m.title}"`).join(", ") : "existing articles"}.
            If this is coincidental (e.g. common facts/phrasing), you can submit anyway — it will be flagged for extra
            editorial review rather than rejected automatically.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmFlag(null);
                setSubmitting(true);
                handleSubmit(true);
              }}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Submit Anyway
            </button>
            <button
              type="button"
              onClick={() => setConfirmFlag(null)}
              className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              Go Back &amp; Edit
            </button>
          </div>
        </div>
      )}

      {preview ? (
        <div className="rounded-lg border border-ink-200 bg-white p-6">
          <h1 className="font-serif text-2xl font-bold text-ink-900">{form.title || "Untitled"}</h1>
          {form.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.image} alt={form.imageAlt} className="mt-4 w-full rounded-lg object-cover" />
          )}
          <p className="mt-4 text-sm italic text-ink-600">{form.excerpt}</p>
          <div className="article-body mt-4" dangerouslySetInnerHTML={{ __html: form.contentHtml }} />
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Title</label>
            <input
              disabled={!editable}
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-lg font-semibold focus:border-signal focus:outline-none disabled:bg-ink-50"
              placeholder="Article title"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">City</label>
              <select
                disabled={!editable}
                value={form.cityId}
                onChange={(e) => update({ cityId: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm focus:border-signal focus:outline-none disabled:bg-ink-50"
              >
                {cities.length === 0 && <option value="">No cities configured yet</option>}
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}, {c.country}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-ink-400">You can write about any city — pick which one this article covers.</p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Category</label>
              <select
                disabled={!editable}
                value={form.categoryId || ""}
                onChange={(e) => update({ categoryId: e.target.value || null })}
                className="mt-1.5 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm focus:border-signal focus:outline-none disabled:bg-ink-50"
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
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Short Summary / Excerpt</label>
            <textarea
              disabled={!editable}
              rows={2}
              value={form.excerpt}
              onChange={(e) => update({ excerpt: e.target.value })}
              className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none disabled:bg-ink-50"
            />
          </div>

          {editable ? (
            <ImageUploadField label="Cover Image" value={form.image} onChange={(url) => update({ image: url })} uploadUrl="/api/dashboard/upload" />
          ) : (
            form.image && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Cover Image</label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image} alt={form.imageAlt} className="mt-1.5 h-32 w-full max-w-sm rounded object-cover" />
              </div>
            )
          )}

          {editable && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Cover Image Alt Text</label>
              <input
                value={form.imageAlt}
                onChange={(e) => update({ imageAlt: e.target.value })}
                placeholder="Describe the image for accessibility & SEO"
                className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm focus:border-signal focus:outline-none"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Article Body</label>
              <span className={`text-[11px] ${plainTextLength < 200 ? "text-signal" : "text-ink-400"}`}>
                {plainTextLength} characters {plainTextLength < 200 ? `(min 200)` : ""}
              </span>
            </div>
            <div className="mt-1.5">
              {editable ? (
                <RichTextEditor
                  value={form.contentHtml}
                  onChange={(html) => update({ contentHtml: html })}
                  uploadUrl="/api/dashboard/upload"
                  onStatsChange={setStats}
                />
              ) : (
                <div className="article-body rounded-lg border border-ink-200 bg-ink-50 p-4" dangerouslySetInnerHTML={{ __html: form.contentHtml }} />
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-ink-400">
              Write the full article here. We don't accept links to external articles as a source — this must be
              your own original reporting. Links are fine when used naturally inside the text.
            </p>
          </div>

          {editable && (
            <details className="rounded-md border border-ink-200 bg-white p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-500">SEO Details (optional)</summary>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-ink-500">Meta Title</label>
                  <input
                    value={form.metaTitle}
                    onChange={(e) => update({ metaTitle: e.target.value })}
                    className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500">Meta Description</label>
                  <input
                    value={form.metaDescription}
                    onChange={(e) => update({ metaDescription: e.target.value })}
                    className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink-500">Focus Keyword</label>
                  <input
                    value={form.focusKeyword}
                    onChange={(e) => update({ focusKeyword: e.target.value })}
                    className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {editable && (
        <div className="flex flex-wrap items-center gap-3 border-t border-ink-200 pt-5">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(false)}
            className="rounded-md bg-signal px-6 py-2.5 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-60"
          >
            {submitting ? "Submitting..." : currentStatus === "rejected" ? "Resubmit for Review" : "Submit for Review"}
          </button>
          {currentStatus === "draft" && id && (
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteDraft}
              className="rounded-md border border-ink-300 px-4 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-100 disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Discard Draft"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
