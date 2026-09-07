"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ArticleWithRelations } from "@/lib/articles";
import type { ArticleRevision } from "@/lib/revisions";
import { articlePath } from "@/lib/destinations";
import TiptapArticleEditor from "@/components/dashboard/TiptapArticleEditor";
import ArticlePreviewModal from "@/components/dashboard/ArticlePreviewModal";
import CropModal from "@/components/dashboard/CropModal";
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

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
  published: { label: "Published", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200" },
  scheduled: { label: "Scheduled", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-200" },
  under_review: { label: "In Review", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-200" },
  pending: { label: "Pending Review", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-200" },
  changes_requested: { label: "Changes Requested", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500", border: "border-orange-200" },
  approved: { label: "Approved", bg: "bg-teal-50", text: "text-teal-700", dot: "bg-teal-500", border: "border-teal-200" },
  rejected: { label: "Rejected", bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", border: "border-rose-200" },
  unpublished: { label: "Unpublished", bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", border: "border-slate-200" },
  draft: { label: "Draft", bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", border: "border-slate-200" },
};

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingCropFile, setPendingCropFile] = useState<{ file: File; url: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const [score, setScore] = useState(article.score !== null ? String(article.score) : "");
  const [feedback, setFeedback] = useState(article.adminFeedback || "");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(
    article.scheduledAt ? new Date(article.scheduledAt).toISOString().slice(0, 16) : ""
  );

  const [edit, setEdit] = useState<EditState>(buildEditState(article));
  const [editorialFlags, setEditorialFlags] = useState({
    featured: article.featured || false,
    trending: article.trending || false,
    editorsPick: article.editorsPick || false,
    breaking: article.breaking || false,
  });

  const currentStatusConfig = STATUS_CONFIG[article.status] || STATUS_CONFIG.draft;

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

  // --- Image Upload & Crop Handlers ---
  function handleFileSelected(file: File) {
    setPendingCropFile({ file, url: URL.createObjectURL(file) });
  }

  async function uploadImageBlob(blob: Blob) {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "featured-cover.jpg");
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      updateEdit("image", data.url);
      toast.success("Featured image uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploadingImage(false);
    }
  }

  // --- Article Status Actions ---
  async function handleStartReview() {
    await callApi({ action: "start_review" }, "Marked as In Review — contributor notified.");
    setShowStatusMenu(false);
  }

  async function handleApproveAndPublish() {
    const ok = await confirm({
      title: "Approve and publish this article live?",
      description: "The contributor will be emailed the score and feedback, and the article will immediately appear on the public site.",
      confirmLabel: "Approve & Publish",
    });
    if (!ok) return;
    await callApi(
      { action: "publish", score: score !== "" ? Number(score) : null, feedback: feedback.trim() },
      "Article approved and published live!"
    );
    setShowStatusMenu(false);
  }

  async function handleApproveOnly() {
    const ok = await confirm({
      title: "Approve this article?",
      description: "The contributor will be emailed the score and feedback. The article won't go live until you publish or schedule it separately.",
      confirmLabel: "Approve",
    });
    if (!ok) return;
    await callApi(
      { action: "review", status: "approved", score: score !== "" ? Number(score) : null, feedback: feedback.trim() },
      "Article approved (ready to publish)."
    );
    setShowStatusMenu(false);
  }

  async function handleReviewDecision(status: "approved" | "changes_requested" | "rejected") {
    if (status !== "approved" && !feedback.trim()) {
      toast.error("Please add feedback so the contributor knows what to fix.");
      return;
    }
    const label =
      status === "approved" ? "Article approved." : status === "rejected" ? "Article rejected." : "Changes requested from contributor.";
    const ok = await confirm({
      title:
        status === "approved"
          ? "Approve this article?"
          : status === "rejected"
          ? "Reject this article?"
          : "Request changes on this article?",
      description: "The contributor will be emailed this decision along with your feedback.",
      confirmLabel: status === "approved" ? "Approve" : status === "rejected" ? "Reject" : "Request Changes",
      danger: status === "rejected",
    });
    if (!ok) return;
    await callApi(
      { action: "review", status, score: score !== "" ? Number(score) : null, feedback: feedback.trim() },
      label
    );
    setShowStatusMenu(false);
  }

  async function handleUpdateReview() {
    const ok = await confirm({
      title: "Save score and feedback changes?",
      description: "This updates the article's editorial score and/or feedback.",
      confirmLabel: "Save Changes",
    });
    if (!ok) return;
    await callApi(
      { action: "update_review", score: score !== "" ? Number(score) : null, feedback: feedback.trim() },
      "Editorial points & feedback updated."
    );
  }

  async function handlePublish() {
    const ok = await confirm({
      title: "Publish this article live?",
      description: "It will immediately appear on the public site and the contributor will be emailed the score and feedback.",
      confirmLabel: "Publish Live",
    });
    if (!ok) return;
    await callApi(
      { action: "publish", score: score !== "" ? Number(score) : null, feedback: feedback.trim() },
      "Article published live!"
    );
    setShowStatusMenu(false);
  }

  async function handleConfirmSchedule() {
    if (!scheduledAt) {
      toast.error("Choose a future date and time.");
      return;
    }
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast.error("Choose a valid future date and time.");
      return;
    }
    const ok = await callApi({ action: "schedule", scheduledAt: when.toISOString() }, "Article scheduled.");
    if (ok) {
      setShowSchedule(false);
      setShowStatusMenu(false);
    }
  }

  async function handleCancelSchedule() {
    const ok = await confirm({
      title: "Cancel this scheduled release?",
      description: "The article will go back to Approved and won't publish automatically.",
      confirmLabel: "Cancel Schedule",
      danger: true,
    });
    if (!ok) return;
    await callApi({ action: "cancel_schedule" }, "Schedule cancelled.");
  }

  async function handleUnpublish() {
    const ok = await confirm({
      title: "Unpublish this article?",
      description: "It will be taken down from the public site and can be republished anytime.",
      confirmLabel: "Unpublish",
      danger: true,
    });
    if (!ok) return;
    await callApi({ action: "unpublish" }, "Article unpublished to draft.");
    setShowStatusMenu(false);
  }

  async function handleSaveAll() {
    if (!edit.title.trim() || !edit.contentHtml.trim()) {
      toast.error("Title and article content are required.");
      return;
    }
    const ok = await confirm({
      title: "Save these changes?",
      description: "The article's title, content, images, and SEO details will be updated.",
      confirmLabel: "Save Changes",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          title: edit.title.trim(),
          slug: edit.slug.trim(),
          excerpt: edit.excerpt.trim(),
          contentHtml: edit.contentHtml,
          cityId: edit.cityId,
          categoryId: edit.categoryId,
          attractionId: edit.attractionId,
          image: edit.image,
          imageAlt: edit.imageAlt,
          metaTitle: edit.metaTitle.trim(),
          metaDescription: edit.metaDescription.trim(),
          focusKeyword: edit.focusKeyword.trim(),
          tags: edit.tags ? edit.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
          canonicalUrl: edit.canonicalUrl.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update article.");
      toast.success("Article updated successfully.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update article.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleFlag(key: keyof typeof editorialFlags) {
    const updated = { ...editorialFlags, [key]: !editorialFlags[key] };
    setEditorialFlags(updated);
    await callApi({ action: "editorial_flags", ...updated }, `Editorial flag updated.`);
  }

  async function handleRestoreRevision(revisionId: number) {
    const ok = await confirm({
      title: "Restore this revision?",
      description: "The article content, title, excerpt, and image will be restored to this saved version.",
      confirmLabel: "Restore Revision",
    });
    if (!ok) return;
    const success = await callApi({ action: "restore_revision", revisionId }, "Revision restored.");
    if (success) setEdit(buildEditState(article));
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Permanently delete "${article.title || "this article"}"?`,
      description: "This cannot be undone. All revisions and statistics will be removed.",
      confirmLabel: "Move to Trash / Delete",
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

  const selectedCityName = useMemo(() => cities.find((c) => c.id === edit.cityId)?.name || "", [cities, edit.cityId]);
  const selectedCategoryName = useMemo(() => categories.find((c) => c.id === edit.categoryId)?.name || "", [categories, edit.categoryId]);

  const isScoreChanged = score !== (article.score !== null ? String(article.score) : "");
  const isFeedbackChanged = feedback.trim() !== (article.adminFeedback || "").trim();
  const isReviewDirty = isScoreChanged || isFeedbackChanged;

  const isContentDirty = useMemo(() => {
    return (
      edit.title.trim() !== (article.title || "").trim() ||
      edit.excerpt.trim() !== (article.excerpt || "").trim() ||
      edit.contentHtml.trim() !== (article.contentHtml || "").trim() ||
      (edit.image || "") !== (article.image || "") ||
      (edit.imageAlt || "") !== (article.imageAlt || "") ||
      edit.cityId !== article.cityId ||
      (edit.categoryId || "") !== (article.categoryId || "") ||
      (edit.attractionId || "") !== (article.attractionId || "") ||
      (edit.metaTitle || "") !== (article.metaTitle || "") ||
      (edit.metaDescription || "") !== (article.metaDescription || "") ||
      (edit.focusKeyword || "") !== (article.focusKeyword || "") ||
      (edit.canonicalUrl || "") !== (article.canonicalUrl || "") ||
      edit.tags.trim() !== (article.tags || []).join(", ").trim()
    );
  }, [edit, article]);

  const canReview = !["published", "scheduled", "unpublished"].includes(article.status);
  const canPublish = ["approved", "unpublished", "scheduled", "pending", "under_review", "changes_requested", "rejected", "draft"].includes(article.status);
  const canSchedule = ["approved", "unpublished", "pending", "under_review"].includes(article.status);

  // Which "Current Status" menu items make sense for the article's actual
  // status — e.g. once it's published, the only meaningful action left here
  // is Unpublish; showing Approve/Reject/Request Changes on an already-live
  // article was confusing and easy to click by mistake.
  const showApproveAction = !["approved", "published", "scheduled", "unpublished"].includes(article.status);
  const showRequestChangesAction = canReview && article.status !== "changes_requested";
  const showRejectAction = canReview && article.status !== "rejected";
  const showUnpublishAction = article.status === "published";

  return (
    <div className="font-sans space-y-6 pb-24 text-slate-800 antialiased">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/admin/articles"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#DC2626] transition-colors"
          >
            ← Back to Articles
          </Link>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Edit Article</h1>
          <p className="text-xs text-slate-500 font-medium">
            Make changes to your article and update the content.
          </p>
        </div>

        {/* Action Buttons & Views Badge in Header */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Live Views Badge */}
          <div
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs"
            title={`${article.viewCount || 0} total unique views`}
          >
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span><strong className="text-slate-900 font-bold">{formatViews(article.viewCount || 0)}</strong> Views</span>
          </div>

          {article.status === "published" && (
            <Link
              href={articlePath(article.countrySlug, article.citySlug, article.slug)}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              View Live Story ↗
            </Link>
          )}

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Preview</span>
          </button>

          <button
            type="button"
            disabled={busy || !isContentDirty}
            onClick={handleSaveAll}
            title={!isContentDirty ? "No changes to save yet" : undefined}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold transition-all shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed ${
              isContentDirty
                ? "bg-[#DC2626] text-white hover:bg-[#B91C1C] shadow-sm ring-2 ring-red-200 cursor-pointer"
                : "bg-slate-300 text-white"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {busy ? "Updating..." : isContentDirty ? "Save Changes *" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT MAIN CANVAS (lg:col-span-8) ================= */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-2xs space-y-5">
            {/* Article Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-900">
                  Article Title <span className="text-[#DC2626]">*</span>
                </label>
                <span className={`text-[11px] font-mono ${edit.title.length > 95 ? "text-amber-600 font-bold" : "text-slate-400"}`}>
                  {edit.title.length}/100
                </span>
              </div>
              <input
                type="text"
                required
                value={edit.title}
                onChange={(e) => updateEdit("title", e.target.value)}
                placeholder="e.g. Amsterdam Travel Guide: Best Places, Attractions & Tips for First-Time Visitors"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none transition-all shadow-2xs"
              />
            </div>

            {/* Slug (URL) */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">Slug (URL)</label>
              <input
                type="text"
                value={edit.slug}
                onChange={(e) =>
                  updateEdit("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
                }
                placeholder="amsterdam-travel-guide-best-places-attractions-tips"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none transition-all shadow-2xs"
              />
              <p className="mt-1 text-[11px] text-slate-400">Keep it short, simple and SEO-friendly.</p>
            </div>

            {/* 3-Column Meta Pickers: Destination, Category, Article Beat / Attraction */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Destination <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">
                    📍
                  </span>
                  <select
                    value={edit.cityId}
                    onChange={(e) => updateEdit("cityId", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-xs font-semibold text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer shadow-2xs appearance-none"
                  >
                    <option value="">Select destination</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-[10px]">
                    ▼
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Category <span className="text-[#DC2626]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">
                    📁
                  </span>
                  <select
                    value={edit.categoryId || ""}
                    onChange={(e) => updateEdit("categoryId", e.target.value || null)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-xs font-semibold text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer shadow-2xs appearance-none"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-[10px]">
                    ▼
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">Article Beat</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">
                    🏷
                  </span>
                  <select
                    value={edit.attractionId || ""}
                    onChange={(e) => updateEdit("attractionId", e.target.value || null)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-xs font-semibold text-slate-800 focus:border-[#DC2626] focus:outline-none cursor-pointer shadow-2xs appearance-none"
                  >
                    <option value="">Travel Guides / General</option>
                    {attractions
                      .filter((a) => !edit.cityId || a.cityId === edit.cityId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-[10px]">
                    ▼
                  </span>
                </div>
              </div>
            </div>

            {/* Short Excerpt / Lead Summary */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-900">
                  Short Excerpt / Lead Summary <span className="text-[#DC2626]">*</span>
                </label>
                <span className={`text-[11px] font-mono ${edit.excerpt.length > 155 ? "text-amber-600 font-bold" : "text-slate-400"}`}>
                  {edit.excerpt.length}/160
                </span>
              </div>
              <textarea
                rows={3}
                value={edit.excerpt}
                onChange={(e) => updateEdit("excerpt", e.target.value)}
                placeholder="Discover the best places to visit in Amsterdam, top attractions, travel tips, and local insights for first-time visitors."
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed transition-all shadow-2xs"
              />
            </div>

            {/* Featured Image */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-900">Featured Image</label>
              <div className="relative aspect-[21/9] w-full overflow-hidden rounded-2xl bg-slate-100 border border-slate-200 group">
                {edit.image ? (
                  <Image src={edit.image} alt={edit.imageAlt || "Featured image"} fill className="object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                    <span>No cover image uploaded</span>
                  </div>
                )}

                {/* Change Image Button in Bottom Right */}
                <div className="absolute bottom-3 right-3 z-10">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelected(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 backdrop-blur px-3.5 py-1.5 text-xs font-bold text-slate-800 shadow-md hover:bg-white transition-all cursor-pointer disabled:opacity-50"
                  >
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {uploadingImage ? "Uploading..." : "Change Image"}
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={edit.imageAlt}
                onChange={(e) => updateEdit("imageAlt", e.target.value)}
                placeholder="Image alt text for accessibility and SEO..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#DC2626] focus:bg-white focus:outline-none"
              />
            </div>

            {/* Article Content with Rich Text Editor */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-bold text-slate-900">
                Article Content <span className="text-[#DC2626]">*</span>
              </label>
              <TiptapArticleEditor
                value={edit.contentHtml}
                onChange={(html) => updateEdit("contentHtml", html)}
                placeholder="Write or edit the article content here..."
                minHeight="28rem"
                stickyOffset="4rem"
                allowLinks
              />
            </div>
          </div>
        </div>

        {/* ================= RIGHT SIDEBAR (lg:col-span-4) ================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Publish Settings */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Publish Settings</h2>
              <span className="text-[11px] font-semibold text-slate-500">
                {article.authorName ? `By ${article.authorName}` : ""}
              </span>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 text-center py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <p className="font-extrabold text-slate-900 text-xs sm:text-sm">{formatViews(article.viewCount || 0)}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Views</p>
              </div>
              <div className="border-x border-slate-200">
                <p className="font-extrabold text-slate-900 text-xs sm:text-sm">{article.wordCount || 0}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Words</p>
              </div>
              <div>
                <p className="font-extrabold text-slate-900 text-xs sm:text-sm">{article.readingTimeMinutes || 1}m</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Read Time</p>
              </div>
            </div>

            {/* Status Dropdown Button */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Current Status</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className={`flex w-full items-center justify-between rounded-xl border ${currentStatusConfig.border} ${currentStatusConfig.bg} px-3.5 py-2.5 text-xs font-bold ${currentStatusConfig.text} transition-colors cursor-pointer shadow-2xs`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${currentStatusConfig.dot}`} />
                    {currentStatusConfig.label}
                  </span>
                  <span className="text-[10px]">▼</span>
                </button>

                {showStatusMenu && (
                  <div className="absolute left-0 right-0 z-20 mt-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl text-xs space-y-1">
                    {canPublish && (
                      <button
                        type="button"
                        onClick={handlePublish}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-bold text-[#DC2626] hover:bg-rose-50 cursor-pointer"
                      >
                        <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
                        Publish Now (Go Live)
                      </button>
                    )}
                    {showApproveAction && (
                      <button
                        type="button"
                        onClick={handleApproveOnly}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Approve Article
                      </button>
                    )}
                    {canSchedule && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSchedule(true);
                          setShowStatusMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        Schedule Release...
                      </button>
                    )}
                    {showRequestChangesAction && (
                      <button
                        type="button"
                        onClick={() => handleReviewDecision("changes_requested")}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-semibold text-orange-700 hover:bg-orange-50 cursor-pointer"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        Request Changes
                      </button>
                    )}
                    {showRejectAction && (
                      <button
                        type="button"
                        onClick={() => handleReviewDecision("rejected")}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        Reject Article
                      </button>
                    )}
                    {showUnpublishAction && (
                      <button
                        type="button"
                        onClick={handleUnpublish}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Unpublish to Draft
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Editorial Score & Feedback Panel */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Editorial Quality Score (0–10)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setScore(String(num))}
                      className={`h-7 w-7 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        score === String(num)
                          ? "bg-[#DC2626] text-white border-[#DC2626] shadow-sm scale-105"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Feedback for Contributor
                </label>
                <textarea
                  rows={2}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Required when requesting changes or rejecting..."
                  className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {isReviewDirty && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleUpdateReview}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    Save Score &amp; Feedback *
                  </button>
                </div>
              )}
            </div>

            {/* Status-Specific Review & Action Buttons */}
            <div className="space-y-2 pt-1">
              {/* 1. If Published */}
              {article.status === "published" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-800">
                    <span className="flex items-center gap-2 font-bold">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live on Public Site
                    </span>
                    <Link
                      href={articlePath(article.countrySlug, article.citySlug, article.slug)}
                      target="_blank"
                      className="font-bold underline text-emerald-900 hover:text-emerald-700"
                    >
                      View Live ↗
                    </Link>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleUnpublish}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
                    >
                      ⏸ Unpublish to Draft
                    </button>
                  </div>
                </div>
              )}

              {/* 2. If Scheduled */}
              {article.status === "scheduled" && (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handlePublish}
                    className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <span>🚀 Publish Live Now (Skip Wait)</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowSchedule(true)}
                      className="flex-1 rounded-xl border border-blue-200 bg-blue-50 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleCancelSchedule}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Cancel Schedule
                    </button>
                  </div>
                </div>
              )}

              {/* 3. If Approved (Ready for publication) */}
              {article.status === "approved" && (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handlePublish}
                    className="w-full rounded-xl bg-[#DC2626] py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-red-700 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <span>🚀 Publish Live Now</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!isReviewDirty || busy}
                      onClick={isReviewDirty ? handleUpdateReview : undefined}
                      className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
                        isReviewDirty
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-2xs"
                          : "bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default opacity-85"
                      }`}
                    >
                      {isReviewDirty ? "Save Score *" : "✓ Approved"}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowSchedule(true)}
                      className="flex-1 rounded-xl border border-blue-200 bg-blue-50 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-all cursor-pointer disabled:opacity-50"
                    >
                      📅 Schedule...
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleReviewDecision("changes_requested")}
                    className="w-full rounded-xl border border-orange-200 bg-orange-50/50 py-1.5 text-[11px] font-bold text-orange-800 hover:bg-orange-100 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Request Changes Instead
                  </button>
                </div>
              )}

              {/* 4. If Pending, In Review, Draft, Changes Requested, or Rejected */}
              {article.status !== "published" && article.status !== "scheduled" && article.status !== "approved" && (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleApproveAndPublish}
                    className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <span>🚀 Approve &amp; Publish Live</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {article.status === "pending" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleStartReview}
                        className="flex-1 rounded-xl border border-amber-300 bg-amber-50 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-all cursor-pointer disabled:opacity-50"
                      >
                        In Review
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleApproveOnly}
                      className="flex-1 rounded-xl border border-emerald-300 bg-emerald-50 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer disabled:opacity-50"
                    >
                      ✓ Approve Only
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleReviewDecision("changes_requested")}
                      className="flex-1 rounded-xl border border-orange-300 bg-orange-50 py-2 text-xs font-bold text-orange-800 hover:bg-orange-100 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Changes
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleReviewDecision("rejected")}
                    className="w-full rounded-xl border border-rose-200 bg-rose-50/50 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Reject Article
                  </button>
                </div>
              )}
            </div>

            {/* Publication Schedule Box */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  {article.status === "scheduled"
                    ? "Scheduled For"
                    : article.status === "published"
                    ? "Publication Info"
                    : "Publication Schedule"}
                </label>
                {article.status === "published" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700 shadow-2xs">
                <span className="text-slate-400">📅</span>
                <span className="font-semibold text-slate-800">
                  {article.scheduledAt
                    ? `Scheduled: ${formatDateTime(article.scheduledAt)}`
                    : article.publishedAt
                    ? `Published: ${formatDateTime(article.publishedAt)}`
                    : article.status === "approved"
                    ? "Approved — Not published yet"
                    : "Not published yet"}
                </span>
              </div>

              {/* Quick Publish / Schedule shortcut buttons inside Schedule box */}
              {article.status === "approved" && (
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handlePublish}
                    className="flex-1 rounded-lg bg-[#DC2626] py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    🚀 Publish Live Now
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setShowSchedule(true)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Schedule
                  </button>
                </div>
              )}
            </div>

            {/* Schedule Picker Mode (if opened) */}
            {showSchedule && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-2">
                <label className="block text-[11px] font-bold text-blue-900">Choose Schedule Date &amp; Time</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 text-xs font-medium text-slate-800 focus:border-[#DC2626] focus:outline-none"
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSchedule(false)}
                    className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleConfirmSchedule}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                  >
                    Confirm Schedule
                  </button>
                </div>
              </div>
            )}

            {article.status === "scheduled" && (
              <button
                type="button"
                disabled={busy}
                onClick={handleCancelSchedule}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel Schedule
              </button>
            )}

            {/* Move to Trash / Delete Button */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="w-full rounded-xl border border-rose-200 bg-white py-2.5 text-xs font-bold text-[#DC2626] hover:bg-rose-50/70 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <svg className="h-4 w-4 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Move to Trash
              </button>
            </div>
          </div>

          {/* Card 2: SEO & Meta Settings */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900">SEO &amp; Meta Settings</h2>

            {/* SEO Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-900">SEO Title</label>
                <span className={`text-[11px] font-mono ${edit.metaTitle.length > 60 ? "text-amber-600 font-bold" : "text-slate-400"}`}>
                  {edit.metaTitle.length}/60
                </span>
              </div>
              <input
                type="text"
                value={edit.metaTitle}
                onChange={(e) => updateEdit("metaTitle", e.target.value)}
                placeholder={edit.title}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none shadow-2xs"
              />
              <div className="mt-1 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${edit.metaTitle.length > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, (edit.metaTitle.length / 60) * 100)}%` }}
                />
              </div>
            </div>

            {/* Meta Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-900">Meta Description</label>
                <span className={`text-[11px] font-mono ${edit.metaDescription.length > 160 ? "text-amber-600 font-bold" : "text-slate-400"}`}>
                  {edit.metaDescription.length}/160
                </span>
              </div>
              <textarea
                rows={3}
                value={edit.metaDescription}
                onChange={(e) => updateEdit("metaDescription", e.target.value)}
                placeholder={edit.excerpt}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none resize-none leading-relaxed shadow-2xs"
              />
              <div className="mt-1 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${edit.metaDescription.length > 160 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${Math.min(100, (edit.metaDescription.length / 160) * 100)}%` }}
                />
              </div>
            </div>

            {/* Focus Keyword */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-900">Focus Keyword</label>
                <span className="text-[11px] font-mono text-slate-400">{edit.focusKeyword.length}/60</span>
              </div>
              <input
                type="text"
                value={edit.focusKeyword}
                onChange={(e) => updateEdit("focusKeyword", e.target.value)}
                placeholder="e.g. Amsterdam travel guide"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none shadow-2xs"
              />
            </div>

            {/* Canonical URL */}
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">Canonical URL</label>
              <input
                type="text"
                value={edit.canonicalUrl}
                onChange={(e) => updateEdit("canonicalUrl", e.target.value)}
                placeholder="https://www.worldattractionnews.com/destinations/..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:border-[#DC2626] focus:outline-none shadow-2xs"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                The authoritative master URL for search engines. Leave blank to automatically use this article&apos;s permalink, or enter an external URL if syndicated from another publication.
              </p>
            </div>
          </div>

          {/* Card 3: Schema & Advanced (Collapsible Accordion) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between p-5 text-left font-bold text-xs text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span>Schema &amp; Advanced</span>
              <span className="text-slate-400 font-bold">{showAdvanced ? "▲" : "▼"}</span>
            </button>

            {showAdvanced && (
              <div className="p-5 border-t border-slate-100 space-y-4 text-xs">
                {/* Author Info */}
                <div className="space-y-1">
                  <p className="font-bold text-slate-800">Author</p>
                  <p className="text-slate-600">
                    {article.authorName} (<span className="text-slate-400">{article.authorEmail}</span>)
                  </p>
                </div>

                {/* Article Placement Flags */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <p className="font-bold text-slate-800">Homepage Rail Placement</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "featured", label: "Featured" },
                      { key: "trending", label: "Trending" },
                      { key: "editorsPick", label: "Editor's Pick" },
                      { key: "breaking", label: "Breaking News" },
                    ].map((flag) => {
                      const isChecked = editorialFlags[flag.key as keyof typeof editorialFlags];
                      return (
                        <button
                          key={flag.key}
                          type="button"
                          onClick={() => handleToggleFlag(flag.key as keyof typeof editorialFlags)}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border font-semibold transition-all cursor-pointer ${
                            isChecked
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span>{flag.label}</span>
                          <span>{isChecked ? "✓" : "+"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="font-bold text-slate-800">{formatViews(article.viewCount)}</p>
                    <p className="text-[10px] text-slate-400">Views</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="font-bold text-slate-800">{article.wordCount}</p>
                    <p className="text-[10px] text-slate-400">Words</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="font-bold text-slate-800">{article.readingTimeMinutes}m</p>
                    <p className="text-[10px] text-slate-400">Read Time</p>
                  </div>
                </div>

                {/* Revision History */}
                {revisions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <p className="font-bold text-slate-800">Revision History ({revisions.length})</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {revisions.map((r) => (
                        <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-[11px]">
                          <div className="min-w-0 pr-2">
                            <p className="font-medium text-slate-800 truncate">{r.changeSummary || "Revision"}</p>
                            <p className="text-slate-400 text-[10px]">{formatDateTime(r.createdAt)}</p>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleRestoreRevision(r.id)}
                            className="font-bold text-[#DC2626] hover:underline cursor-pointer disabled:opacity-50"
                          >
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Crop Modal */}
      {pendingCropFile && (
        <CropModal
          src={pendingCropFile.url}
          aspectRatio={21 / 9}
          onConfirm={(blob) => {
            URL.revokeObjectURL(pendingCropFile.url);
            setPendingCropFile(null);
            uploadImageBlob(blob);
          }}
          onCancel={() => {
            URL.revokeObjectURL(pendingCropFile.url);
            setPendingCropFile(null);
          }}
        />
      )}

      {/* Article Preview Modal */}
      {previewOpen && (
        <ArticlePreviewModal
          title={edit.title}
          image={edit.image}
          imageAlt={edit.imageAlt}
          excerpt={edit.excerpt}
          contentHtml={edit.contentHtml}
          cityName={selectedCityName}
          categoryName={selectedCategoryName}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
