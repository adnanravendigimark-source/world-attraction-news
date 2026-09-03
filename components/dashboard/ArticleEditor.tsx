"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import ImageUploadField from "@/components/ImageUploadField";
import StatusBadge from "@/components/StatusBadge";
import ArticlePreviewModal from "@/components/dashboard/ArticlePreviewModal";
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
  slug?: string;
}

const AUTOSAVE_DELAY_MS = 2500;
const EDITABLE_STATUSES = ["draft", "pending", "rejected", "changes_requested"];

function computeStats(html: string) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
  const words = text ? text.split(/\s+/).length : 0;
  return {
    words,
    characters: text.length,
    readingTimeMinutes: words ? Math.max(1, Math.round(words / 200)) : 0,
  };
}

// Same "auto-fill while the field is still empty" contract as the slug
// below: derives a short summary from the article body (falling back to
// the title if there's no body yet), but only while the contributor hasn't
// typed anything into Excerpt themselves — the moment they do, this stops
// touching it.
function deriveExcerpt(html: string, title: string): string {
  const plainText = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const source = plainText || title.trim();
  if (!source) return "";
  if (source.length <= 160) return source;
  const truncated = source.slice(0, 160);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated).trim()}…`;
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
    slug: initial?.slug || "",
  });

  const [slug, setSlug] = useState(
    initial?.slug || (initial?.title ? initial.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : "")
  );
  const [stats, setStats] = useState(() => computeStats(initial?.contentHtml || ""));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const dirtyRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const idRef = useRef(id);
  idRef.current = id;

  const editable = !currentStatus || EDITABLE_STATUSES.includes(currentStatus);
  const canSubmit = !currentStatus || currentStatus === "draft" || currentStatus === "rejected" || currentStatus === "changes_requested";

  const save = useCallback(
    async (value: EditorValue) => {
      setSaveState("saving");
      setSaveError("");
      try {
        const payload = {
          title: value.title,
          excerpt: value.excerpt,
          contentHtml: value.contentHtml,
          cityId: value.cityId,
          categoryId: value.categoryId,
          attractionId: value.attractionId,
          image: value.image,
          imageAlt: value.imageAlt,
          metaTitle: value.metaTitle,
          metaDescription: value.metaDescription,
          focusKeyword: value.focusKeyword,
          slug: slug || value.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        };

        if (idRef.current) {
          const res = await fetch(`/api/dashboard/articles/${idRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Autosave failed.");
        } else {
          const res = await fetch("/api/dashboard/articles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Save failed.");
          idRef.current = data.article.id;
          setId(data.article.id);
          setCurrentStatus(data.article.status);
          window.history.replaceState(null, "", `/contributor/articles/${data.article.id}/edit`);
        }
        setSaveState("saved");
        dirtyRef.current = false;
      } catch (err) {
        setSaveState("error");
        setSaveError(err instanceof Error ? err.message : "Save failed.");
      }
    },
    [slug]
  );

  function scheduleAutosave(next: EditorValue) {
    if (!editable) return;
    dirtyRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save(next);
    }, AUTOSAVE_DELAY_MS);
  }

  function updateField<K extends keyof EditorValue>(key: K, value: EditorValue[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "title" && !slug) {
        setSlug(String(value).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
      }
      if (key === "title" && !prev.excerpt) {
        next.excerpt = deriveExcerpt(prev.contentHtml, String(value));
      }
      if (key === "cityId" && prev.attractionId) {
        const stillValid = attractions.some((a) => a.id === prev.attractionId && a.cityId === value);
        if (!stillValid) next.attractionId = null;
      }
      scheduleAutosave(next);
      return next;
    });
  }

  function updateContent(html: string) {
    setForm((prev) => {
      const next = { ...prev, contentHtml: html };
      if (!prev.excerpt) {
        next.excerpt = deriveExcerpt(html, prev.title);
      }
      scheduleAutosave(next);
      return next;
    });
    setStats(computeStats(html));
  }

  // Mirrors the server's own minimums in
  // app/api/dashboard/articles/[id]/submit/route.ts so a contributor finds
  // out what's missing immediately instead of round-tripping to the API
  // first — the server re-checks every one of these itself regardless, so
  // this is purely a faster/friendlier first pass, never the real gate.
  function findSubmitValidationError(): string | null {
    if (form.title.trim().length < 8) return "Title must be at least 8 characters.";
    if (!form.excerpt.trim()) return "Add a short summary/excerpt.";
    const plainTextLength = form.contentHtml.replace(/<[^>]*>/g, "").trim().length;
    if (plainTextLength < 200) return "Article body must contain at least 200 characters of actual written content.";
    if (!form.image) return "Upload a cover image.";
    return null;
  }

  async function handleSubmitArticle(confirmDespiteFlag = false) {
    const validationError = findSubmitValidationError();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!confirmDespiteFlag) {
      const ok = await confirm({
        title: "Submit article for editorial review?",
        description: "Our editorial desk will verify factual accuracy, assign a quality score, and decide whether to publish it.",
        confirmLabel: "Submit for Review",
      });
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      let targetId = idRef.current;
      if (!targetId) {
        const createRes = await fetch("/api/dashboard/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, slug }),
        });
        const created = await createRes.json();
        if (!createRes.ok) throw new Error(created.error || "Save failed.");
        targetId = created.article.id;
        idRef.current = targetId;
        setId(targetId);
      } else {
        const saveRes = await fetch(`/api/dashboard/articles/${targetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, slug }),
        });
        const saved = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok) throw new Error(saved.error || "Couldn't save your latest changes.");
      }

      const res = await fetch(`/api/dashboard/articles/${targetId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmDespiteFlag }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed.");

      // The moderation pass flagged this as similar to something already on
      // the site — it was NOT submitted. Ask the contributor to confirm
      // before we resubmit with confirmDespiteFlag: true (see
      // app/api/dashboard/articles/[id]/submit/route.ts).
      if (data.needsConfirmation) {
        setSubmitting(false);
        const proceedAnyway = await confirm({
          title: "This looks similar to an existing article",
          description:
            "Our originality check found significant overlap with content already on the site. You can still submit it for an editor to review, or go back and revise it first.",
          confirmLabel: "Submit Anyway",
        });
        if (proceedAnyway) {
          await handleSubmitArticle(true);
        }
        return;
      }

      toast.success("Article submitted for review!");
      router.push(`/contributor/articles/${targetId}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit article.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Heading */}
      <div className="space-y-1">
        <Link
          href="/contributor/articles"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#F43F5E] transition-colors mb-1"
        >
          <span>← Back to Articles</span>
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          {articleId ? "Edit Article" : "Write New Article"}
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Share your travel experience, tips and insights with our global audience.
        </p>
      </div>

      {/* Main Article Form */}
      <div className="w-full space-y-5">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-2xs space-y-5">
          {/* Article Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Article Title *</label>
              <span className="text-[10px] font-mono text-slate-400">{form.title.length}/100</span>
            </div>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              maxLength={100}
              placeholder="Enter a compelling article title..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#F43F5E] focus:outline-none transition-all"
            />
          </div>

          {/* Slug (URL) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Slug (URL)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
              placeholder="your-article-url"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:border-[#F43F5E] focus:bg-white focus:outline-none transition-all"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Auto-filled from your title as you type — edit it any time. Used in the article's URL, so keep it short and SEO friendly.
            </p>
          </div>

          {/* Category & Destination 2-Col Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Category Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 text-xs">
                  📁
                </span>
                <select
                  value={form.categoryId || ""}
                  onChange={(e) => updateField("categoryId", e.target.value || null)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-medium text-slate-800 focus:border-[#F43F5E] focus:outline-none"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Destination Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Destination</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 text-xs">
                  📍
                </span>
                <select
                  value={form.cityId}
                  onChange={(e) => updateField("cityId", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-medium text-slate-800 focus:border-[#F43F5E] focus:outline-none"
                >
                  <option value="">Select destination</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}, {c.country}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Related Attraction */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Related Attraction <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 text-xs">
                🏷
              </span>
              <select
                value={form.attractionId || ""}
                onChange={(e) => updateField("attractionId", e.target.value || null)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-medium text-slate-800 focus:border-[#F43F5E] focus:outline-none"
              >
                <option value="">General travel guide (not attraction-specific)</option>
                {attractions
                  .filter((a) => !form.cityId || a.cityId === form.cityId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Link this article to a specific attraction in {cities.find((c) => c.id === form.cityId)?.name || "your chosen destination"} if it's about one.
            </p>
          </div>

          {/* Excerpt / Short Summary */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Excerpt / Short Summary *</label>
              <span className="text-[10px] font-mono text-slate-400">{form.excerpt.length}/180</span>
            </div>
            <textarea
              rows={3}
              value={form.excerpt}
              onChange={(e) => updateField("excerpt", e.target.value)}
              maxLength={180}
              placeholder="Write a short summary of your article..."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#F43F5E] focus:outline-none resize-none leading-relaxed transition-all"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Auto-filled from your article body as you write — edit it any time to write your own.
            </p>
          </div>

          {/* Featured Image */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Featured Image *</label>
            <div className="grid gap-4 sm:grid-cols-12 items-center">
              <div className="sm:col-span-7">
                <ImageUploadField
                  label="Click to upload or drag and drop (JPG, PNG, WebP)"
                  value={form.image}
                  onChange={(url) => updateField("image", url)}
                  uploadUrl="/api/dashboard/upload"
                />
              </div>
              {form.image && (
                <div className="sm:col-span-5 space-y-1.5">
                  <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <Image src={form.image} alt={form.imageAlt || "Featured"} fill className="object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField("image", "")}
                    className="text-[11px] font-semibold text-slate-500 hover:text-[#F43F5E] transition-colors"
                  >
                    🔄 Change Image
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Content *</label>
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white focus-within:border-[#F43F5E]">
              <RichTextEditor
                value={form.contentHtml}
                onChange={updateContent}
                placeholder="Start writing your article here..."
                uploadUrl="/api/dashboard/upload"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-1">
              <span>{saveState === "saving" ? "Autosaving..." : saveState === "saved" ? "✓ Saved" : ""}</span>
              <span>Words: {stats.words}</span>
            </div>
          </div>

          {/* SEO & Meta Settings Collapsible */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <button
              type="button"
              onClick={() => setSeoOpen(!seoOpen)}
              className="flex w-full items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">⚙️</span>
                <div>
                  <h3 className="text-xs font-bold text-slate-800">SEO &amp; Meta Settings</h3>
                  <p className="text-[11px] text-slate-400">Optimize your article for search engines and social media.</p>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-bold">{seoOpen ? "▲" : "▼"}</span>
            </button>

            {seoOpen && (
              <div className="mt-4 space-y-3 pt-3 border-t border-slate-200 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Meta Title</label>
                  <input
                    type="text"
                    value={form.metaTitle}
                    onChange={(e) => updateField("metaTitle", e.target.value)}
                    placeholder="Custom SEO Title Tag"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#F43F5E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Meta Description</label>
                  <textarea
                    rows={2}
                    value={form.metaDescription}
                    onChange={(e) => updateField("metaDescription", e.target.value)}
                    placeholder="Custom SEO Description"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#F43F5E] focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Focus Keyword</label>
                  <input
                    type="text"
                    value={form.focusKeyword}
                    onChange={(e) => updateField("focusKeyword", e.target.value)}
                    placeholder="e.g. Paris Travel Guide"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#F43F5E] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Form Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => save(form)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
              >
                <span>💾 Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
              >
                <span>👁 Preview</span>
              </button>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmitArticle()}
              className="rounded-xl bg-gradient-to-r from-[#F43F5E] to-[#E11D48] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:from-[#E11D48] hover:to-[#BE123C] transition-all disabled:opacity-60 cursor-pointer"
            >
              {submitting ? "Submitting..." : "Submit for Review →"}
            </button>
          </div>
        </div>
      </div>

      {previewOpen && (
        <ArticlePreviewModal
          title={form.title}
          image={form.image}
          imageAlt={form.imageAlt}
          excerpt={form.excerpt}
          contentHtml={form.contentHtml}
          cityName={cities.find((c) => c.id === form.cityId)?.name || ""}
          categoryName={categories.find((c) => c.id === form.categoryId)?.name || ""}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
