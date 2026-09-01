import Image from "next/image";
import Link from "next/link";
import type { ArticleWithRelations } from "@/lib/articles";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ArticleCard({
  article,
  size = "default",
  rank,
}: {
  article: ArticleWithRelations;
  size?: "default" | "large" | "compact";
  rank?: number;
}) {
  const href = `/cities/${article.citySlug}/${article.slug}`;

  if (size === "compact") {
    return (
      <Link href={href} className="group flex items-center gap-3 py-2.5">
        {rank !== undefined && (
          <span className="w-6 shrink-0 font-serif text-2xl font-bold text-ink-200 group-hover:text-signal">
            {String(rank).padStart(2, "0")}
          </span>
        )}
        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-ink-100">
          {article.image && (
            <Image src={article.image} alt={article.imageAlt || article.title} fill sizes="80px" className="object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-signal">{article.cityName}</p>
          <h3 className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug text-ink-900 group-hover:text-signal">
            {article.title}
          </h3>
        </div>
      </Link>
    );
  }

  return (
    <Link href={href} className="group flex flex-col overflow-hidden rounded-lg border border-ink-100 bg-white shadow-card transition-shadow hover:shadow-lift">
      <div className={`relative w-full overflow-hidden bg-ink-100 ${size === "large" ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
        {article.image && (
          <Image
            src={article.image}
            alt={article.imageAlt || article.title}
            fill
            sizes={size === "large" ? "(min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-signal">
          <span>{article.cityName}</span>
          {article.categoryName && (
            <>
              <span className="text-ink-300" aria-hidden="true">·</span>
              <span className="text-ink-500">{article.categoryName}</span>
            </>
          )}
        </div>
        <h3 className={`mt-1.5 font-serif font-bold leading-snug text-ink-900 group-hover:text-signal ${size === "large" ? "text-xl sm:text-2xl" : "text-base"}`}>
          {article.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-600">{article.excerpt}</p>
        <div className="mt-auto pt-3 text-[11px] text-ink-400">
          By {article.authorName} · {formatDate(article.publishedAt)}
        </div>
      </div>
    </Link>
  );
}
