"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import ImageUploadField from "./ImageUploadField";
import TiptapArticleEditor from "./TiptapArticleEditor";
import ArticlePreviewModal from "./ArticlePreviewModal";
import CityAutocomplete, { type CitySelection } from "@/components/CityAutocomplete";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { slugifyCountry } from "@/lib/countries";

// Sentinel value for the Destination <select>'s "Other" option — never a
// real city id (those are UUIDs from the database), so it can't collide
// with an actual selection.
const OTHER_CITY_VALUE = "__other__";

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600";
const labelClass = "mb-1 block text-sm font-medium text-stone-700";
const hintClass = "mt-1 text-xs text-stone-500";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFromContent(html: string, maxChars = 200): string {
  const text = stripHtml(html);
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).replace(/\s+\S*$/, "") + "…";
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className={hintClass}>{hint}</p>}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6">
      <p className="font-semibold text-stone-900">{title}</p>
      {description && <p className="mt-0.5 text-xs text-stone-500">{description}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </div>
  );
}

export interface ArticleFormValues {
  title: string;
  slug: string;
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
  canonicalUrl: string;
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
  initial?: Partial<ArticleFormValues>;
  status?: string;
  cities: { id: string; name: string; country: string }[];
  categories: { id: string; name: string }[];
  attractions: { id: string; name: string; cityId: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const isNew = !articleId;
  const [id, setId] = useState<string | undefined>(articleId);
  const idRef = useRef(id);
  idRef.current = id;

  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Destination "Other" flow — lets a contributor pick a city/country that
  // isn't in the admin-curated `cities` list yet, via the same
  // CityAutocomplete + /api/geo/cities search the Admin Add Destination
  // form uses. `otherLabel` is only set once the pick has actually been
  // resolved to a real cityId (see resolveOtherCity below) — until then
  // form.cityId still holds whatever it held before switching into "Other"
  // mode, and findSubmitValidationError() below blocks submitting with a
  // stale/unresolved selection.
  const [destinationMode, setDestinationMode] = useState<"select" | "other">("select");
  const [otherLabel, setOtherLabel] = useState("");
  const [resolvingCity, setResolvingCity] = useState(false);

  const [form, setForm] = useState<ArticleFormValues>({
    title: initial?.title || "",
    slug: initial?.slug || (initial?.title ? slugify(initial.title) : ""),
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
    canonicalUrl: initial?.canonicalUrl || "",
  });

  function update<K extends keyof ArticleFormValues>(key: K, value: ArticleFormValues[K]) {
    setForm((p) => {
      const next = { ...p, [key]: value };
      if (key === "cityId" && p.attractionId) {
        const stillValid = attractions.some((a) => a.id === p.attractionId && a.cityId === value);
        if (!stillValid) next.attractionId = null;
      }
      return next;
    });
    setDirty(true);
    setSaved(false);
  }

  // Turns a CityAutocomplete pick into a real cityId: reuses an existing
  // city if one already matches (name, country) exactly, otherwise creates
  // a minimal new one — see lib/cities.ts's resolveOrCreateCity() (which
  // this API route wraps) for why that dedup matters. Contributors aren't
  // allowed to freely create/edit destinations the way an admin can; this
  // is the one narrow, safe city-write their own flow can trigger.
  async function resolveOtherCity(selection: CitySelection) {
    setResolvingCity(true);
    try {
      const res = await fetch("/api/dashboard/cities/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: selection.city, country: selection.country }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save that destination.");
      update("cityId", data.city.id);
      setOtherLabel(`${data.city.name}, ${data.city.country}`);
      toast.success(`Destination set to ${data.city.name}, ${data.city.country}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that destination.");
    } finally {
      setResolvingCity(false);
    }
  }

  function updateTitle(value: string) {
    update("title", value);
    if (isNew && !slugTouched) {
      update("slug", slugify(value));
    }
  }

  const wordCount = useMemo(() => stripHtml(form.contentHtml).split(/\s+/).filter(Boolean).length, [form.contentHtml]);
  const autoExcerpt = useMemo(() => excerptFromContent(form.contentHtml), [form.contentHtml]);
  const previewCity = useMemo(() => cities.find((c) => c.id === form.cityId), [cities, form.cityId]);
  const previewCityName = previewCity?.name || "";
  // Real articlePath() needs the city's actual countrySlug from the DB, which
  // this form doesn't have (cities here only carry the display name) — this
  // is only cosmetic (the Google snippet preview below), so slugifying the
  // country display name is a fine approximation; the real saved article
  // always resolves its link through lib/destinations.ts on the server.
  const previewCountrySlug = previewCity?.country ? slugifyCountry(previewCity.country) : "";
  const previewCategoryName = useMemo(
    () => categories.find((c) => c.id === form.categoryId)?.name || "",
    [categories, form.categoryId]
  );
  // The picker only ever lists attractions that belong to the currently
  // selected destination — an attraction is scoped to exactly one city (see
  // lib/attractions.ts), so this is never "all attractions, filtered down
  // to nothing by mistake." If this comes back empty, that destination
  // genuinely has zero attractions saved in Admin -> Attractions yet.
  const attractionsForCity = useMemo(
    () => attractions.filter((a) => !form.cityId || a.cityId === form.cityId),
    [attractions, form.cityId]
  );

  const saveDraft = useCallback(
    async (showNotification = true) => {
      setSaving(true);
      setError("");

      const payload = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        excerpt: form.excerpt || autoExcerpt,
        contentHtml: form.contentHtml,
        cityId: form.cityId,
        categoryId: form.categoryId,
        attractionId: form.attractionId,
        image: form.image,
        imageAlt: form.imageAlt,
        metaTitle: form.metaTitle,
        metaDescription: form.metaDescription,
        focusKeyword: form.focusKeyword,
        canonicalUrl: form.canonicalUrl,
      };

      try {
        if (idRef.current) {
          const res = await fetch(`/api/dashboard/articles/${idRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Save failed.");
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
          window.history.replaceState(null, "", `/contributor/articles/${data.article.id}/edit`);
        }

        setDirty(false);
        setSaved(true);
        if (showNotification) {
          toast.success("Draft saved successfully.");
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Save failed.";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [form, autoExcerpt, toast]
  );

  // Autosave: once there's a title to actually save (avoids persisting a
  // blank "Untitled draft" row from an accidental click into another
  // field), save silently a couple of seconds after the contributor stops
  // typing/making changes. Manual "Save Draft" (toast on) still works the
  // same as before; this just means a contributor who navigates away or
  // loses their connection doesn't lose work in between manual saves.
  useEffect(() => {
    if (!dirty || saving || submitting || !form.title.trim()) return;
    const t = setTimeout(() => {
      saveDraft(false);
    }, 2500);
    return () => clearTimeout(t);
  }, [dirty, saving, submitting, form.title, saveDraft]);

  function findSubmitValidationError(): string | null {
    if (form.title.trim().length < 8) return "Title must be at least 8 characters.";
    if (destinationMode === "other" && !otherLabel) {
      return "Search for and select a city for this article's destination.";
    }
    if (!form.cityId) return "Select a destination for this article.";
    if (!form.excerpt.trim() && !autoExcerpt.trim()) return "Add a short summary/excerpt.";
    const plainTextLength = form.contentHtml.replace(/<[^>]*>/g, "").trim().length;
    if (plainTextLength < 200) return "Article body must contain at least 200 characters of actual written content.";
    if (!form.image) return "Upload a hero/cover image.";
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
      let targetId = idRef.current;
      if (!targetId) {
        const createRes = await fetch("/api/dashboard/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, excerpt: form.excerpt || autoExcerpt }),
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
          body: JSON.stringify({ ...form, excerpt: form.excerpt || autoExcerpt }),
        });
        const savedData = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok) throw new Error(savedData.error || "Couldn't save your latest changes.");
      }

      const res = await fetch(`/api/dashboard/articles/${targetId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmDespiteFlag }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed.");

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

  function handleCancel() {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    router.push("/contributor/articles");
  }

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-4xl space-y-5">
        {status === "published" && form.slug && (
          <div className="flex justify-end">
            <a
              href={`/articles/${form.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open this article on the live site"
              className="flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100"
            >
              View Article ↗
            </a>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {saved && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            Saved — all changes are stored in your draft.
          </p>
        )}

        {/* ---------------- CONTENT SECTION ---------------- */}
        <div className="space-y-5">
          <SectionCard title="Basics" description="What readers see as the title, destination, and where the article lives.">
            <Field label="Title (H1 on the page)">
              <input
                required
                value={form.title}
                onChange={(e) => updateTitle(e.target.value)}
                className={inputClass}
                placeholder="e.g. Best Time to Visit Universal Epic Universe Orlando"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="URL slug"
                hint={
                  isNew
                    ? "Auto-fills from the title. Article will live at /articles/" + (form.slug || "…")
                    : "Article address slug."
                }
              >
                <input
                  required
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    update("slug", slugify(e.target.value));
                  }}
                  className={inputClass}
                  placeholder="best-time-to-visit-epic-universe"
                />
              </Field>
              <Field label="Category">
                <select
                  value={form.categoryId || ""}
                  onChange={(e) => update("categoryId", e.target.value || null)}
                  className={inputClass}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Destination (City)"
                hint={
                  destinationMode === "other"
                    ? "Search for the city — we'll fill in the country automatically."
                    : undefined
                }
              >
                {destinationMode === "select" ? (
                  <select
                    value={form.cityId}
                    onChange={(e) => {
                      if (e.target.value === OTHER_CITY_VALUE) {
                        setDestinationMode("other");
                        setOtherLabel("");
                        return;
                      }
                      update("cityId", e.target.value);
                    }}
                    className={inputClass}
                  >
                    <option value="">Select destination</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}, {c.country}
                      </option>
                    ))}
                    <option value={OTHER_CITY_VALUE}>Other (city not listed)…</option>
                  </select>
                ) : (
                  <div className="space-y-2">
                    <CityAutocomplete
                      placeholder="e.g. New Delhi, India"
                      onSelect={resolveOtherCity}
                      inputClassName={inputClass}
                    />
                    {resolvingCity && <p className="text-xs text-stone-500">Saving destination…</p>}
                    {!resolvingCity && otherLabel && (
                      <p className="text-xs font-medium text-green-700">✓ Destination set to {otherLabel}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDestinationMode("select");
                        setOtherLabel("");
                        update("cityId", cities[0]?.id || "");
                      }}
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      ← Choose from list instead
                    </button>
                  </div>
                )}
              </Field>
              <Field
                label="Related Attraction (optional)"
                hint={
                  form.cityId && attractionsForCity.length === 0
                    ? `No attractions saved yet for ${previewCityName || "this destination"} — an admin can add one from Admin → Attractions.`
                    : undefined
                }
              >
                <select
                  value={form.attractionId || ""}
                  onChange={(e) => update("attractionId", e.target.value || null)}
                  className={inputClass}
                >
                  <option value="">General guide (not attraction-specific)</option>
                  {attractionsForCity.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* No aspectRatio — ImageUploadField skips the forced-crop step
                entirely when it's unset (see its own handleFileSelected) and
                uploads the file exactly as chosen, so the cover image keeps
                its real aspect ratio instead of being cropped to 21:9. */}
            <ImageUploadField
              label="Hero / Cover image"
              value={form.image}
              onChange={(url) => update("image", url)}
            />
            <Field label="Image alt text" hint="Describe the photo for screen readers and search engines.">
              <input
                required
                value={form.imageAlt}
                onChange={(e) => update("imageAlt", e.target.value)}
                className={inputClass}
                placeholder="e.g. Aerial view of Universal Epic Universe theme park"
              />
            </Field>
          </SectionCard>

          <SectionCard title="Summary" description="Shown on article listing cards and previews.">
            <div>
              <label className={labelClass}>Excerpt</label>
              <div className="relative">
                <textarea
                  rows={3}
                  value={form.excerpt || autoExcerpt}
                  onChange={(e) => update("excerpt", e.target.value)}
                  className={`${inputClass} leading-relaxed`}
                  placeholder="Start writing the article below and this will fill in automatically."
                />
              </div>
              <p className={hintClass}>
                Auto-generated from the article content (3 lines, then &quot;…&quot;) — shown on the article cards. Edit any time to customize.
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Article Content"
            description="Write the article top to bottom, just like a normal document. Use the toolbar to make text a heading, add bold/links/lists/tables, or drop in an image."
          >
            <TiptapArticleEditor
              value={form.contentHtml}
              onChange={(html) => update("contentHtml", html)}
              placeholder="Write the article here… use the toolbar for headings, bold, links, lists, tables, or images."
              allowedHeadings={[2, 3]}
              minHeight="26rem"
              stickyOffset="4rem"
            />
            <p className="text-xs text-stone-500">~{wordCount} words in the article body.</p>
          </SectionCard>

          <SectionCard
            title="Search Engine Optimization (SEO)"
            description="Customize how this article will appear on Google search results and social media shares."
          >
            {/* Google Search Snippet Preview */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                  W
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-800 leading-none">World Attraction News</p>
                  <p className="text-[10px] text-slate-500 truncate leading-none mt-0.5">
                    https://worldattractionnews.com/{previewCountrySlug || "country"}/{previewCityName ? slugify(previewCityName) : "city"}/{form.slug || "article-url"}
                  </p>
                </div>
              </div>
              <p className="text-sm font-semibold text-[#1a0dab] line-clamp-1 hover:underline cursor-pointer">
                {form.metaTitle || form.title || "Article Title | World Attraction News"}
              </p>
              <p className="text-xs text-[#4d5156] line-clamp-2 leading-relaxed">
                {form.metaDescription || form.excerpt || autoExcerpt || "Read the latest news, guides, and in-depth reviews on attractions and destinations around the world."}
              </p>
            </div>

            {/* SEO Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelClass}>SEO Title</label>
                <span
                  className={`text-[11px] font-mono ${
                    form.metaTitle.length > 60 ? "text-amber-600 font-bold" : "text-stone-400"
                  }`}
                >
                  {form.metaTitle.length}/60
                </span>
              </div>
              <input
                value={form.metaTitle}
                onChange={(e) => update("metaTitle", e.target.value)}
                className={inputClass}
                placeholder={form.title ? `${form.title} | World Attraction News` : "e.g. 10 Best Attractions in Paris You Must Visit"}
              />
              <p className={hintClass}>
                Custom title tag for search engine results. If left blank, the article title will be used. (Recommended: 50–60 characters)
              </p>
            </div>

            {/* Meta Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelClass}>Meta Description</label>
                <span
                  className={`text-[11px] font-mono ${
                    form.metaDescription.length > 160 ? "text-amber-600 font-bold" : "text-stone-400"
                  }`}
                >
                  {form.metaDescription.length}/160
                </span>
              </div>
              <textarea
                rows={3}
                value={form.metaDescription}
                onChange={(e) => update("metaDescription", e.target.value)}
                className={`${inputClass} leading-relaxed`}
                placeholder={
                  form.excerpt || autoExcerpt || "e.g. Discover the top attractions, opening hours, and insider tips for visiting Paris in 2026."
                }
              />
              <p className={hintClass}>
                Brief summary displayed under the title in Google search results. (Recommended: 140–160 characters)
              </p>
            </div>

            {/* Focus Keyword */}
            <Field
              label="Focus Keyword / Search Term (optional)"
              hint="The primary search phrase or keyword this article is optimized for (e.g. 'paris theme park guide')."
            >
              <input
                value={form.focusKeyword}
                onChange={(e) => update("focusKeyword", e.target.value)}
                className={inputClass}
                placeholder="e.g. epic universe tips"
              />
            </Field>
          </SectionCard>
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur md:pl-64">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <p className="text-xs text-stone-500">{saving ? "Saving draft…" : dirty ? "Unsaved changes" : "All changes saved"}</p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-100 cursor-pointer"
            >
              Preview
            </button>
            <button
              type="button"
              disabled={saving || submitting}
              onClick={() => saveDraft(true)}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-100 disabled:opacity-60 cursor-pointer"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button
              type="button"
              disabled={saving || submitting}
              onClick={() => handleSubmitArticle()}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 shadow-sm cursor-pointer"
            >
              {submitting ? "Submitting…" : "Submit for Review →"}
            </button>
          </div>
        </div>
      </div>

      {previewOpen && (
        <ArticlePreviewModal
          title={form.title}
          image={form.image}
          imageAlt={form.imageAlt}
          excerpt={form.excerpt || autoExcerpt}
          contentHtml={form.contentHtml}
          cityName={previewCityName}
          categoryName={previewCategoryName}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
