"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import ImageUploadField from "@/components/ImageUploadField";
import StatusBadge from "@/components/StatusBadge";
import { useConfirm } from "@/components/ConfirmProvider";
import { useToast } from "@/components/ToastProvider";

interface EditorValue {
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
}

const AUTOSAVE_DELAY_MS = 2500;
const EDITABLE_STATUSES = ["draft", "pending", "rejected", "changes_requested"];

export default function ArticleEditor({
  articleId,
  initial,
  status,
  cities,
  categories,
  attractions,
}: {
  articleId?: string;
  initial?: Partial<EditorValue>;
  status?: string;
  cities: { id: string; name: string; country: string }[];
  categories: { id: string; name: string }[];
  attractions: { id: string; name: string; cityId: string }[];
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
    attractionId: initial?.attractionId ?? null,
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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const dirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const idRef = useRef(id);
  idRef.current = id;

  const editable = !currentStatus || EDITABLE_STATUSES.includes(currentStatus);
  const plainTextLength = form.contentHtml.replace(/<[^>]*>/g, "").trim().length;
  const attractionsForCity = attractions.filter((a) => a.cityId === form.cityId);

  const save = useCallback(async (value: EditorValue) => {
    if (!value.cityId) return;
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
  }, [form, editable, save]);

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
    if (!form.cityId) return toast.error("Select which destination bureau this article covers.");
    if (!form.excerpt.trim()) return toast.error("Add a short summary / excerpt.");
    if (plainTextLength < 200) return toast.error("Article body must contain at least 200 characters of written content.");
    if (!form.image) return toast.error("Upload a cover image for the dispatch.");

    if (!confirmDespiteFlag) {
      const isResubmit = currentStatus === "rejected" || currentStatus === "changes_requested";
      const ok = await confirm({
        title: isResubmit ? "Resubmit dispatch for editorial review?" : "Submit dispatch for review?",
        description: "An editor will review it, assign quality scoring, and schedule publication.",
        confirmLabel: isResubmit ? "Resubmit" : "Submit Dispatch",
      });
      if (!ok) return;
    }

    setSubmitting(true);
    try {
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

      toast.success("Dispatch submitted to the editorial desk.");
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
      title: "Discard this draft dispatch?",
      description: "This action cannot be undone.",
      confirmLabel: "Discard Draft",
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
    <div className="space-y-6">
      {/* Top Sticky Utility Header */}
      <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-200/80 bg-white/95 backdrop-blur-md px-5 py-3 shadow-card">
        <div className="flex items-center gap-3">
          <StatusBadge status={currentStatus || "draft"} />
          <span className="h-4 w-px bg-ink-200" aria-hidden="true" />
          <span className="font-mono text-xs text-ink-500">
            {stats.words} words · {stats.readingTimeMinutes || 1} min read
          </span>
        </div>

        <div className="flex items-center gap-3">
          {saveState === "saving" && (
            <span className="flex items-center gap-1.5 text-xs text-ink-400">
              <span className="h-2 w-2 rounded-full bg-signal animate-pulse" />
              Autosaving...
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <span>✓</span> Saved
            </span>
          )}
          {saveState === "error" && (
            <span className="text-xs font-bold text-signal">{saveError}</span>
          )}

          {editable && (
            <button
              type="button"
              onClick={handleManualSave}
              className="text-xs font-bold text-ink-700 hover:text-signal transition-colors"
            >
              Save Draft
            </button>
          )}

          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
              preview
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-ink-200 bg-paper-100 text-ink-700 hover:bg-paper-200"
            }`}
          >
            {preview ? "Edit Mode" : "Preview"}
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
              sidebarOpen
                ? "border-ink-900 bg-paper-200 text-ink-950"
                : "border-ink-200 bg-white text-ink-700 hover:bg-paper-100"
            }`}
            title="Toggle Metadata Sidebar"
          >
            ⚙ Settings
          </button>

          {editable && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="rounded-lg bg-signal px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark hover:shadow-lift transition-all disabled:opacity-60"
            >
              {submitting
                ? "Submitting..."
                : currentStatus === "rejected" || currentStatus === "changes_requested"
                ? "Resubmit"
                : "Submit"}
            </button>
          )}
        </div>
      </div>

      {/* Rejection / Changes notice */}
      {(currentStatus === "rejected" || currentStatus === "changes_requested") && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-900 shadow-subtle">
          <p className="font-bold">Editorial Desk Notice:</p>
          <p className="mt-1">
            Revisions were requested on this submission. Update your draft according to the feedback, then resubmit.
          </p>
        </div>
      )}

      {/* Originality overlap modal / warning */}
      {confirmFlag && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 shadow-lift">
          <div className="flex items-center gap-2">
            <span className="font-bold">⚠ Content Overlap Detected</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-amber-800">
            Our originality verification noticed similarities with{" "}
            {confirmFlag.matches.length
              ? confirmFlag.matches.map((m) => `"${m.title}" (${Math.round(m.similarity * 100)}% match)`).join(", ")
              : "existing site coverage"}
            . If this is common factual phrasing, you may submit anyway for manual review.
          </p>
          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                setConfirmFlag(null);
                setSubmitting(true);
                handleSubmit(true);
              }}
              className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800"
            >
              Submit Anyway for Editor Review
            </button>
            <button
              type="button"
              onClick={() => setConfirmFlag(null)}
              className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
            >
              Review &amp; Edit Content
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas & Metadata Sidebar Grid */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Left / Center Writing Canvas */}
        <div className={`${sidebarOpen ? "lg:col-span-8" : "lg:col-span-12"} space-y-6 transition-all`}>
          {preview ? (
            <div className="rounded-2xl border border-ink-200/80 bg-white p-8 shadow-card">
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-signal mb-2">
                <span>Preview Mode</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl font-black text-ink-950 leading-tight">
                {form.title || "Untitled Dispatch"}
              </h1>
              {form.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.image}
                  alt={form.imageAlt || "Cover"}
                  className="mt-6 w-full rounded-xl object-cover aspect-[16/9] shadow-subtle"
                />
              )}
              {form.excerpt && (
                <p className="mt-6 font-serif text-base italic text-ink-600 border-l-2 border-signal pl-4 py-1">
                  {form.excerpt}
                </p>
              )}
              <div className="article-body mt-8 border-t border-ink-100 pt-6" dangerouslySetInnerHTML={{ __html: form.contentHtml }} />
            </div>
          ) : (
            <div className="rounded-2xl border border-ink-200/80 bg-white p-6 sm:p-10 shadow-card space-y-6">
              {/* Frameless Notion-Style Headline */}
              <div>
                <input
                  disabled={!editable}
                  value={form.title}
                  onChange={(e) => update({ title: e.target.value })}
                  className="w-full font-serif text-2xl sm:text-4xl font-black tracking-tight text-ink-950 placeholder:text-ink-300 focus:outline-none disabled:bg-transparent"
                  placeholder="Article Headline..."
                />
              </div>

              {/* Excerpt Lead */}
              <div>
                <textarea
                  disabled={!editable}
                  rows={2}
                  value={form.excerpt}
                  onChange={(e) => update({ excerpt: e.target.value })}
                  className="w-full font-sans text-sm text-ink-700 placeholder:text-ink-400 border-b border-ink-100 pb-3 focus:outline-none focus:border-signal disabled:bg-transparent resize-none leading-relaxed"
                  placeholder="Short editorial summary or lead paragraph..."
                />
              </div>

              {/* Rich Canvas Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-ink-400">
                    Dispatch Content
                  </span>
                  <span className={`text-[11px] font-mono ${plainTextLength < 200 ? "text-signal font-bold" : "text-ink-400"}`}>
                    {plainTextLength} chars {plainTextLength < 200 ? `(min 200 required)` : ""}
                  </span>
                </div>
                {editable ? (
                  <RichTextEditor
                    value={form.contentHtml}
                    onChange={(html) => update({ contentHtml: html })}
                    uploadUrl="/api/dashboard/upload"
                    onStatsChange={setStats}
                    placeholder="Write your on-the-ground report here..."
                  />
                ) : (
                  <div
                    className="article-body rounded-xl border border-ink-200 bg-paper-50 p-6"
                    dangerouslySetInnerHTML={{ __html: form.contentHtml }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          {editable && (
            <div className="flex items-center justify-between border-t border-ink-200/80 pt-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit(false)}
                  className="rounded-xl bg-signal px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-card hover:bg-signal-dark hover:shadow-lift transition-all disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Dispatch"}
                </button>
              </div>

              {currentStatus === "draft" && id && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteDraft}
                  className="text-xs font-bold text-ink-400 hover:text-signal transition-colors"
                >
                  {deleting ? "Discarding..." : "Discard Draft"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Metadata Drawer / Settings */}
        {sidebarOpen && (
          <div className="lg:col-span-4 rounded-2xl border border-ink-200/80 bg-white p-6 shadow-card space-y-6">
            <div className="border-b border-ink-100 pb-3">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-signal">Editorial Metadata</p>
              <h3 className="font-serif text-lg font-black text-ink-900">Publishing Settings</h3>
            </div>

            {/* Destination Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
                Destination Bureau
              </label>
              <select
                disabled={!editable}
                value={form.cityId}
                onChange={(e) => update({ cityId: e.target.value, attractionId: null })}
                className="w-full rounded-lg border border-ink-200 bg-paper-50 px-3 py-2 text-xs font-semibold text-ink-900 focus:border-signal focus:outline-none"
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}, {c.country}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Beat */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
                Category Beat
              </label>
              <select
                disabled={!editable}
                value={form.categoryId || ""}
                onChange={(e) => update({ categoryId: e.target.value || null })}
                className="w-full rounded-lg border border-ink-200 bg-paper-50 px-3 py-2 text-xs font-semibold text-ink-900 focus:border-signal focus:outline-none"
              >
                <option value="">No category selected</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Specific Attraction */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
                Specific Landmark (Optional)
              </label>
              <select
                disabled={!editable}
                value={form.attractionId || ""}
                onChange={(e) => update({ attractionId: e.target.value || null })}
                className="w-full rounded-lg border border-ink-200 bg-paper-50 px-3 py-2 text-xs font-semibold text-ink-900 focus:border-signal focus:outline-none"
              >
                <option value="">General City Coverage</option>
                {attractionsForCity.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cover Image Upload */}
            <div className="border-t border-ink-100 pt-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-2">
                Cover Photography
              </label>
              {editable ? (
                <ImageUploadField
                  label="Cover Photography"
                  value={form.image}
                  onChange={(url) => update({ image: url })}
                  uploadUrl="/api/dashboard/upload"
                />
              ) : (
                form.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image} alt={form.imageAlt} className="h-32 w-full rounded-lg object-cover" />
                )
              )}

              {editable && form.image && (
                <div className="mt-3">
                  <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">
                    Photo Credit / Alt Text
                  </label>
                  <input
                    value={form.imageAlt}
                    onChange={(e) => update({ imageAlt: e.target.value })}
                    placeholder="Describe image or attribute source"
                    className="w-full rounded-lg border border-ink-200 px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* SEO Metadata Accordion */}
            {editable && (
              <details className="border-t border-ink-100 pt-4 group">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-ink-700 hover:text-signal list-none flex items-center justify-between">
                  <span>SEO &amp; Search Optimization</span>
                  <span className="text-ink-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Meta Title</label>
                    <input
                      value={form.metaTitle}
                      onChange={(e) => update({ metaTitle: e.target.value })}
                      placeholder="Custom search headline"
                      className="w-full rounded-lg border border-ink-200 px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Meta Description</label>
                    <textarea
                      rows={2}
                      value={form.metaDescription}
                      onChange={(e) => update({ metaDescription: e.target.value })}
                      placeholder="Search snippet summary"
                      className="w-full rounded-lg border border-ink-200 px-3 py-1.5 text-xs focus:border-signal focus:outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-ink-500 mb-1">Focus Keyword</label>
                    <input
                      value={form.focusKeyword}
                      onChange={(e) => update({ focusKeyword: e.target.value })}
                      placeholder="e.g. Disneyland Paris Tickets"
                      className="w-full rounded-lg border border-ink-200 px-3 py-1.5 text-xs focus:border-signal focus:outline-none"
                    />
                  </div>
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
