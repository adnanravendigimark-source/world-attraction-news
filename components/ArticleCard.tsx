import Image from "next/image";
import Link from "next/link";
import type { ArticleWithRelations } from "@/lib/articles";
import { articlePath } from "@/lib/destinations";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ArticleCard({
  article,
  size = "default",
  rank,
  showExcerpt = true,
}: {
  article: ArticleWithRelations;
  size?: "default" | "large" | "compact" | "horizontal" | "overlay";
  rank?: number;
  showExcerpt?: boolean;
}) {
  // Real article URL — /latest-news is the listing page, not an article
  // namespace. The route (see the Destinations country+city URL restructure)
  // is /destinations/[countrySlug]/[citySlug]/[slug].
  const href = articlePath(article.countrySlug, article.citySlug, article.slug);

  // Compact wire-feed variant (used in top stories lists, sidebar, trending)
  if (size === "compact") {
    return (
      <Link href={href} className="group flex items-start gap-3.5 py-3 transition-colors">
        {rank !== undefined && (
          <span className="w-7 shrink-0 font-mono text-xl font-bold tracking-tight text-ink-300 transition-colors group-hover:text-signal">
            {String(rank).padStart(2, "0")}
          </span>
        )}
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-paper-200 border border-ink-100/60 shadow-subtle">
          {article.image && (
            <Image
              src={article.image}
              alt={article.imageAlt || article.title}
              fill
              sizes="96px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-signal">
            <span>{article.cityName}</span>
            {article.breaking && (
              <span className="rounded bg-signal px-1 py-0.2 text-[9px] text-white">Live</span>
            )}
          </div>
          <h3 className="mt-1 line-clamp-2 font-serif text-sm font-bold leading-snug text-ink-900 transition-colors group-hover:text-signal">
            {article.title}
          </h3>
          <p className="mt-1 text-[11px] text-ink-400">
            {formatDate(article.publishedAt)} · {article.readingTimeMinutes || 3} min read
          </p>
        </div>
      </Link>
    );
  }

  // Horizontal split layout (feature articles / category lead)
  if (size === "horizontal" || size === "large") {
    return (
      <Link
        href={href}
        className="group grid gap-5 sm:grid-cols-12 overflow-hidden rounded-xl border border-ink-200/70 bg-white p-4 sm:p-5 shadow-card transition-all hover:shadow-lift hover:border-ink-300"
      >
        <div className="relative aspect-[16/10] sm:aspect-auto sm:col-span-5 overflow-hidden rounded-lg bg-paper-200">
          {article.image && (
            <Image
              src={article.image}
              alt={article.imageAlt || article.title}
              fill
              sizes="(min-width: 1024px) 35vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          )}
          {article.breaking && (
            <span className="absolute top-3 left-3 rounded bg-signal px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
              Breaking
            </span>
          )}
        </div>
        <div className="flex flex-col justify-between sm:col-span-7 py-1">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-signal">
              <span>{article.cityName}</span>
              {article.categoryName && (
                <>
                  <span className="text-ink-300" aria-hidden="true">·</span>
                  <span className="text-ink-500">{article.categoryName}</span>
                </>
              )}
            </div>
            <h3 className="mt-2 font-serif text-xl sm:text-2xl font-black leading-tight text-ink-900 transition-colors group-hover:text-signal">
              {article.title}
            </h3>
            {showExcerpt && article.excerpt && (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-600">
                {article.excerpt}
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-xs text-ink-500">
            <span>By <strong className="font-semibold text-ink-800">{article.authorName}</strong></span>
            <span>{formatDate(article.publishedAt)} · {article.readingTimeMinutes || 3} min</span>
          </div>
        </div>
      </Link>
    );
  }

  // Standard Magazine Card
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-ink-200/70 bg-white shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lift hover:border-ink-300"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-paper-200">
        {article.image && (
          <Image
            src={article.image}
            alt={article.imageAlt || article.title}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {article.breaking && (
          <span className="absolute top-2.5 left-2.5 rounded bg-signal px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
            Breaking
          </span>
        )}
        {article.editorsPick && !article.breaking && (
          <span className="absolute top-2.5 left-2.5 rounded bg-ink-900/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Editor's Pick
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-signal">
          <span>{article.cityName}</span>
          {article.categoryName && (
            <>
              <span className="text-ink-300" aria-hidden="true">·</span>
              <span className="text-ink-500">{article.categoryName}</span>
            </>
          )}
        </div>
        <h3 className="mt-2 font-serif text-lg sm:text-xl font-black leading-snug text-ink-900 transition-colors group-hover:text-signal">
          {article.title}
        </h3>
        {showExcerpt && article.excerpt && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-600">
            {article.excerpt}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between border-t border-ink-100 pt-3 text-[11px] text-ink-400">
          <span className="truncate max-w-[140px]">By {article.authorName}</span>
          <span>{formatDate(article.publishedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
