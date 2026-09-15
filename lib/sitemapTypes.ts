// Pure, dependency-free constants shared by both the server-side
// lib/sitemaps.ts (DB queries, imports lib/articles.ts etc.) and client
// components like components/admin/SitemapsManager.tsx. Kept in their own
// file specifically so a "use client" component can value-import
// SITEMAP_TYPES/SITEMAP_TYPE_LABELS without webpack pulling the entire
// server module graph (Neon DB client, lib/articles.ts -> lib/scheduling.ts
// -> lib/newsletter.ts -> lib/email.ts -> resend) into the browser bundle.
//
// Exactly 5 types, each backed by its own dedicated route file
// (app/sitemap-<type>.xml/route.ts) and its own single-content-type query
// in lib/sitemaps.ts. There is no "Custom" type — a sitemap's Type strictly
// controls what it may contain, and Admin can only ever pick one of these
// 5 real, code-defined content types, never an open-ended or free-form one.

export type SitemapType = "STATIC" | "COUNTRY" | "CITY" | "CATEGORY" | "ARTICLE";

export const SITEMAP_TYPES: SitemapType[] = ["STATIC", "COUNTRY", "CITY", "CATEGORY", "ARTICLE"];

export const SITEMAP_TYPE_LABELS: Record<SitemapType, string> = {
  STATIC: "Static Pages",
  COUNTRY: "Countries",
  CITY: "Cities",
  CATEGORY: "Categories",
  ARTICLE: "Articles",
};

// A single URL a sitemap can list.
export interface SitemapUrlEntry {
  loc: string;
  lastModified?: string;
}
