"use client";

import Image from "next/image";

// A quick "how will this actually look?" check before submitting — renders
// the article with the same typography (prose prose-slate) the public
// article page and the contributor's own read-only article-detail view
// both use, so what the contributor sees here is a true preview, not just
// a differently-styled approximation.
export default function ArticlePreviewModal({
  title,
  image,
  imageAlt,
  excerpt,
  contentHtml,
  cityName,
  categoryName,
  onClose,
}: {
  title: string;
  image: string;
  imageAlt: string;
  excerpt: string;
  contentHtml: string;
  cityName: string;
  categoryName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-8" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white/95 backdrop-blur-xs px-5 py-3.5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">Preview</p>
            <p className="text-[11px] text-slate-400">This is how your article will look once published.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close preview"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 sm:p-8 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#DC2626]">
              {cityName && <span>{cityName}</span>}
              {cityName && categoryName && <span className="text-slate-300">·</span>}
              {categoryName && <span className="text-slate-500">{categoryName}</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {title || "Untitled Article"}
            </h1>
            {excerpt && <p className="text-sm text-slate-600 leading-relaxed">{excerpt}</p>}
          </div>

          {image && (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <Image src={image} alt={imageAlt || title} fill className="object-cover" />
            </div>
          )}

          {contentHtml && contentHtml !== "<p></p>" ? (
            <div
              className="prose prose-slate max-w-none text-slate-800 text-sm sm:text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          ) : (
            <p className="text-sm text-slate-400 italic">Nothing written yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
