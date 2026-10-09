import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "./site";

// Every JSON-LD block on the site is embedded via
// dangerouslySetInnerHTML={{ __html: jsonLdScript(...) }} inside a
// <script type="application/ld+json"> tag. Plain JSON.stringify() does NOT
// escape "<", so a value that legitimately reaches this function — an
// article title, a city/category/attraction name, an author bio — and
// happens to contain the literal sequence "</script>" would close the
// JSON-LD script tag early and let whatever text follows execute as
// HTML/script in the page. These fields are contributor/admin-authored, not
// anonymous public input, but a compromised or malicious contributor
// account is exactly the kind of actor this should not trust blindly — this
// is a textbook stored-XSS-via-JSON-LD vector and costs nothing to close.
// The line/paragraph separator characters (U+2028/U+2029, referenced here by
// code point to avoid invisible characters in source) are valid in JSON
// strings but are illegal raw line terminators in some JS-parsing contexts,
// so they're escaped too.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);
const UNSAFE_JSON_LD_CHARS = new RegExp(`[<>&${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`, "g");

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE_JSON_LD_CHARS, (ch) => {
    if (ch === "<") return "\\u003c";
    if (ch === ">") return "\\u003e";
    if (ch === "&") return "\\u0026";
    if (ch === LINE_SEPARATOR) return "\\u2028";
    return "\\u2029";
  });
}

export function buildMetadata({
  title,
  description,
  path,
  image,
  noIndex,
  noFollow,
  canonicalOverride,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
  noFollow?: boolean;
  // Admin-set canonical override (Article Review -> SEO & Metadata). Only a
  // handful of articles ever set this (syndicated/duplicate content cases);
  // everything else falls back to the page's own real URL.
  canonicalOverride?: string;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: canonicalOverride || url },
    robots: {
      index: !noIndex,
      follow: !noFollow,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export async function resolvePageMetadata(
  path: string,
  options: {
    title: string;
    description: string;
    image?: string;
    canonicalOverride?: string;
    noIndex?: boolean;
    noFollow?: boolean;
  }
): Promise<Metadata> {
  let noIndex = options.noIndex;
  let noFollow = options.noFollow;

  if (noIndex === undefined || noFollow === undefined) {
    try {
      const { getPageIndexing } = await import("./indexing");
      const indexing = await getPageIndexing(path);
      if (noIndex === undefined) noIndex = indexing.noIndex;
      if (noFollow === undefined) noFollow = indexing.noFollow;
    } catch {
      // fall through
    }
  }

  return buildMetadata({
    ...options,
    path,
    noIndex: Boolean(noIndex),
    noFollow: Boolean(noFollow),
  });
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

// Used on /destinations, /categories, and their individual [slug] pages — tells
// search engines these are genuine listing pages over real content, not
// arbitrary pages, and gives them the list of what's on the page.
export function itemListJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: `${SITE_URL}${item.path}`,
    })),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
  };
}

// The system byline used for AI-assisted news (users.slug of the "World
// Attraction News" author created by scripts/setup-db.mjs). It is the
// newsroom, not a person, so structured data describes it as an Organization.
export const NEWSROOM_AUTHOR_SLUG = "world-attraction-news";

export function newsArticleJsonLd(article: {
  title: string;
  description: string;
  image: string;
  imageSize?: { width: number; height: number } | null; // known cover size (news covers are 1200×675)
  path: string;
  authorName: string;
  authorSlug?: string | null;
  publishedAt: string | null;
  updatedAt: string;
  cityName?: string;
  section?: string | null;
  keywords?: string[];
}) {
  const authorUrl = article.authorSlug ? `${SITE_URL}/author/${article.authorSlug}` : undefined;
  const author =
    article.authorSlug === NEWSROOM_AUTHOR_SLUG
      ? { "@type": "Organization", name: article.authorName, url: authorUrl }
      : { "@type": "Person", name: article.authorName, url: authorUrl };
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title.slice(0, 110),
    description: article.description,
    image: article.image
      ? article.imageSize
        ? [{ "@type": "ImageObject", url: article.image, width: article.imageSize.width, height: article.imageSize.height }]
        : [article.image]
      : undefined,
    datePublished: article.publishedAt || article.updatedAt,
    dateModified: article.updatedAt,
    author,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${article.path}` },
    articleSection: article.section || undefined,
    keywords: article.keywords && article.keywords.length ? article.keywords.join(", ") : undefined,
    isAccessibleForFree: true,
    contentLocation: article.cityName ? { "@type": "Place", name: article.cityName } : undefined,
  };
}

// Person schema for /author/[slug] pages.
export function personJsonLd(author: { name: string; slug: string; bio: string; avatarUrl: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    url: `${SITE_URL}/author/${author.slug}`,
    description: author.bio || undefined,
    image: author.avatarUrl || undefined,
  };
}
