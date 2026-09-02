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

// Same word-count/reading-time math as RichTextEditor's onUpdate handler,
// just runnable against raw HTML up front (before the editor instance
// exists) rather than only through its live onUpdate callback.
function computeStats(html: string) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
  const words = text ? text.split(/\s+/).length : 0;
  return {
    words,
    characters: text.length,
    readingTimeMinutes: words ? Math.max(1, Math.round(words / 200)) : 0,
  };
}

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
    categoryId: initial?.categoryId ?? (categories[0]?.id || null),
    attractionId: initial?.attractionId ?? null,
    image: initial?.image || "",
    imageAlt: initial?.imageAlt || "",
    metaTitle: initial?.metaTitle || "",
    metaDescription: initial?.metaDescription || "",
    focusKeyword: initial?.focusKeyword || "",
  });
  // Seed from the initial content so opening an existing draft shows its
  // real word count immediately — TipTap's onUpdate (which normally drives
  // this) only fires on further edits, never on the initial mount, so
  // without this a draft with 2,000 words already written would read
  // "0 words" until you typed a single character.
  const [stats, setStats] = useState(() => computeStats(initial?.contentHtml || ""));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmFlag, setConfirmFlag] = useState<{ matches: { title: string; similarity: number }[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);

  const dirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const idRef = useRef(id);
  idRef.current = id;

  const editable = !currentStatus || EDITABLE_STATUSES.includes(currentStatus);
  // A subset of "editable" — pending is editable (small fixes before
  // review) but not (re)submittable, since it's already in the queue.
  const canSubmit = !currentStatus || currentStatus === "draft" || currentStatus === "rejected" || currentStatus === "changes_requested";
  const attractionsForCity = attractions.filter((a) => a.cityId === form.cityId);

  const save = useCallback(
    async (value: EditorValue) => {
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
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Couldn't save changes.");
        setSaveState("saved");
        dirtyRef.current = false;
      } catch (err) {
        setSaveState("error");
        setSaveError(err instanceof Error ? err.message : "Save failed.");
      }
    },
    []
  );

  // Autosave handler
  useEffect(() => {
    if (!editable) return;
    if (!dirtyRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save(form);
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [form, editable, save]);

  function handleChange<K extends keyof EditorValue>(key: K, value: EditorValue[K]) {
    dirtyRef.current = true;
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleManualSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await save(form);
    toast.success(currentStatus && currentStatus !== "draft" ? "Changes saved." : "Article saved as draft.");
  }

  // Mirrors the /submit route's own minimums (lib/dashboard/articles/[id]/submit's
  // route.ts) so a contributor sees the real reason up front instead of an
  // unnecessary round trip that 400s with the same message.
  async function handleSubmit(confirmDespiteFlag = false) {
    if (form.title.trim().length < 8) {
      toast.error("Title must be at least 8 characters.");
      return;
    }
    if (!form.cityId) {
      toast.error("Please select a destination city.");
      return;
    }
    if (!form.excerpt.trim()) {
      toast.error("Add a short summary/excerpt.");
      return;
    }
    if (form.contentHtml.replace(/<[^>]*>/g, "").trim().length < 200) {
      toast.error("Article body must contain at least 200 characters of actual written content.");
      return;
    }
    if (!form.image) {
      toast.error("Upload a cover image.");
      return;
    }

    if (!confirmDespiteFlag) {
      const isResubmit = currentStatus === "rejected" || currentStatus === "changes_requested";
      const ok = await confirm({
        title: isResubmit ? "Resubmit this article for review?" : "Submit this article for editorial review?",
        description:
          "Our newsroom editors will review your article for accuracy, factual consistency, and quality.",
        confirmLabel: isResubmit ? "Resubmit Article" : "Submit for Review",
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
      if (!res.ok) throw new Error(data.error || "Couldn't submit article.");

      if (data.needsConfirmation) {
        setConfirmFlag({ matches: data.originality?.matches || [] });
        setSubmitting(false);
        return;
      }

      toast.success("Article submitted to the editorial desk!");
      router.push("/dashboard/articles");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  }

  async function handleDeleteDraft() {
    if (!idRef.current) return;
    const ok = await confirm({
      title: "Discard this draft article?",
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
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="sticky top-14 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-md px-4 py-2.5 shadow-2xs">
        {/* Status & Wordcount */}
        <div className="flex items-center gap-2.5">
          <StatusBadge status={currentStatus || "draft"} />
          <span className="h-3.5 w-px bg-slate-200" aria-hidden="true" />
          <span className="text-xs text-slate-500 font-medium">
            {stats.words} words · {stats.readingTimeMinutes || 1} min read
          </span>
        </div>

        {/* Autosave & Actions */}
        <div className="flex items-center gap-2.5">
          {saveState === "saving" && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626] animate-pulse" />
              Autosaving...
            </span>
          )}
          {saveState === "saved" && (
            <span className="text-xs font-semibold text-emerald-700">✓ Saved</span>
          )}
          {saveState === "error" && (
            <span className="text-xs font-bold text-[#DC2626]">{saveError}</span>
          )}

          {editable && (
            <button
              type="button"
              onClick={handleManualSave}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {currentStatus && currentStatus !== "draft" ? "Save Changes" : "Save Draft"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${preview
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
          >
            {preview ? "Edit Mode" : "Preview"}
          </button>

          {/* Submit/Resubmit only makes sense from draft, rejected, or
              changes_requested — a "pending" article is already sitting in
              the review queue, so showing an active Submit button there
              would just 409 against /submit's own guard when clicked. */}
          {canSubmit && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="rounded-lg bg-[#DC2626] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-2xs hover:bg-[#B91C1C] transition-all disabled:opacity-60 cursor-pointer"
            >
              {submitting
                ? "Submitting..."
                : currentStatus === "rejected" || currentStatus === "changes_requested"
                  ? "Resubmit"
                  : "Submit Article →"}
            </button>
          )}
          {editable && !canSubmit && (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              Awaiting editorial review
            </span>
          )}
        </div>
      </div>

      {/* Rejection / Changes Notice Banner */}
      {(currentStatus === "rejected" || currentStatus === "changes_requested") && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
          <p className="font-bold">Editorial Review Notice:</p>
          <p className="mt-0.5 text-rose-800">
            Revisions were requested on this submission. Please update your draft per editor notes and resubmit.
          </p>
        </div>
      )}

      {/* Originality overlap warning */}
      {confirmFlag && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
          <p className="font-bold mb-1">⚠ Content Overlap Detected</p>
          <p className="text-amber-800 leading-relaxed mb-3">
            Our originality verification noticed similarities with existing coverage. If this is standard factual phrasing, you may submit anyway for editor review.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmFlag(null);
                setSubmitting(true);
                handleSubmit(true);
              }}
              className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800"
            >
              Submit for Manual Review
            </button>
            <button
              type="button"
              onClick={() => setConfirmFlag(null)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              Edit Content
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="grid gap-5 lg:grid-cols-12 items-start">
        {/* Left Column: Writing Canvas (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {preview ? (
            /* Preview Mode */
            <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
                <span>Preview Mode</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
                {form.title || "Untitled Article"}
              </h1>
              {form.excerpt && (
                <p className="text-sm text-slate-600 font-medium leading-relaxed italic border-l-2 border-[#DC2626] pl-3">
                  {form.excerpt}
                </p>
              )}
              {form.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.image}
                  alt={form.imageAlt || "Cover"}
                  className="w-full rounded-lg object-cover max-h-96"
                />
              )}
              <div
                className="prose prose-slate max-w-none text-slate-800 text-sm sm:text-base leading-relaxed pt-3"
                dangerouslySetInnerHTML={{ __html: form.contentHtml || "<p>No content written yet.</p>" }}
              />
            </div>
          ) : (
            /* Edit Mode Canvas */
            <div className="space-y-4">
              {/* Title Input */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Article Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  placeholder="Enter a compelling article headline..."
                  className="w-full text-lg sm:text-xl font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none"
                />
              </div>

              {/* Excerpt / Summary Input */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Short Excerpt / Lead Summary
                </label>
                <textarea
                  rows={2}
                  value={form.excerpt}
                  onChange={(e) => handleChange("excerpt", e.target.value)}
                  placeholder="Write a brief 1-2 sentence overview of the story..."
                  className="w-full text-xs sm:text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* TipTap Rich Text Editor */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1">
                  Article Body *
                </label>
                <RichTextEditor
                  value={form.contentHtml}
                  onChange={(html) => handleChange("contentHtml", html)}
                  uploadUrl="/api/dashboard/upload"
                  onStatsChange={setStats}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Settings & Metadata Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Destination & Category Settings */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              Story Organization
            </h3>

            {/* City */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Destination City *
              </label>
              <select
                value={form.cityId}
                onChange={(e) => {
                  // Switching cities invalidates any previously-selected
                  // landmark from the old city — clear it rather than
                  // silently saving a city/attraction pair that don't
                  // match (the dropdown below only ever shows landmarks
                  // for the *new* city, so a stale id would otherwise
                  // persist invisibly).
                  const nextCityId = e.target.value;
                  dirtyRef.current = true;
                  setForm((prev) => ({
                    ...prev,
                    cityId: nextCityId,
                    attractionId: attractions.some((a) => a.id === prev.attractionId && a.cityId === nextCityId)
                      ? prev.attractionId
                      : null,
                  }));
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Category Beat
              </label>
              <select
                value={form.categoryId || ""}
                onChange={(e) => handleChange("categoryId", e.target.value || null)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Specific Attraction */}
            {attractionsForCity.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Specific Landmark (Optional)
                </label>
                <select
                  value={form.attractionId || ""}
                  onChange={(e) => handleChange("attractionId", e.target.value || null)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
                >
                  <option value="">None (City-Wide Story)</option>
                  {attractionsForCity.map((att) => (
                    <option key={att.id} value={att.id}>
                      {att.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cover Photo */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              Featured Cover Image
            </h3>
            <ImageUploadField
              label="Upload Photo"
              value={form.image}
              onChange={(url) => handleChange("image", url)}
              uploadUrl="/api/dashboard/upload"
            />
            {form.image && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Image Alt Description
                </label>
                <input
                  type="text"
                  value={form.imageAlt}
                  onChange={(e) => handleChange("imageAlt", e.target.value)}
                  placeholder="e.g. Universal Epic Universe Celestial Park Entrance"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* SEO & Metadata (Collapsible) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <button
              type="button"
              onClick={() => setSeoOpen(!seoOpen)}
              className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-800 cursor-pointer"
            >
              <span>SEO &amp; Meta Settings</span>
              <span className="text-slate-400">{seoOpen ? "▲" : "▼"}</span>
            </button>

            {seoOpen && (
              <div className="mt-3.5 space-y-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Meta Title
                  </label>
                  <input
                    type="text"
                    value={form.metaTitle}
                    onChange={(e) => handleChange("metaTitle", e.target.value)}
                    placeholder="Search engine title..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Meta Description
                  </label>
                  <textarea
                    rows={2}
                    value={form.metaDescription}
                    onChange={(e) => handleChange("metaDescription", e.target.value)}
                    placeholder="Search snippet summary..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Focus Keyword
                  </label>
                  <input
                    type="text"
                    value={form.focusKeyword}
                    onChange={(e) => handleChange("focusKeyword", e.target.value)}
                    placeholder="e.g. epic universe, disney fireworks"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Discard Draft Option */}
          {idRef.current && currentStatus === "draft" && (
            <div className="pt-1">
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteDraft}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Discarding..." : "Discard Draft"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
