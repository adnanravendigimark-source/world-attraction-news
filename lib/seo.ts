import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "./site";

export function buildMetadata({
  title,
  description,
  path,
  image,
  noIndex,
  canonicalOverride,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
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
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
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

// Used on /cities, /categories, and their individual [slug] pages — tells
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

export function newsArticleJsonLd(article: {
  title: string;
  description: string;
  image: string;
  path: string;
  authorName: string;
  publishedAt: string | null;
  updatedAt: string;
  cityName: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.description,
    image: article.image ? [article.image] : undefined,
    datePublished: article.publishedAt || article.updatedAt,
    dateModified: article.updatedAt,
    author: { "@type": "Person", name: article.authorName },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}${article.path}`,
    contentLocation: { "@type": "Place", name: article.cityName },
  };
}
