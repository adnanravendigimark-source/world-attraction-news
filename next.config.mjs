/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Vercel Blob-hosted uploads (contributor + admin submitted images) and
    // Unsplash (used only for the initial seeded launch articles/city hero
    // photos — see scripts/setup-db.mjs). Everything else must go through
    // the upload endpoints (Blob), never a pasted external URL — this list
    // is intentionally short so a stray hotlinked image URL fails loudly in
    // dev instead of silently rendering.
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // Google's default profile photo host — a contributor who signs up
      // with Google gets this as their avatarUrl until they upload their
      // own (see lib/googleAuth.ts). Without this, next/image would throw
      // on any Google-signup contributor's avatar wherever it's rendered
      // (e.g. /author/[slug]) — this was a latent bug, not something new.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizeCss: true,
  },
  // The Phase [Destinations] URL restructure moved the whole
  // country/city-scoped subtree from /cities/* to /destinations/[country]/
  // [city]/*. The bare index has no dynamic segment, so it's handled here as
  // a simple permanent (308) redirect; every path *under* /cities/[citySlug]
  // needs a database lookup to resolve the city's country, which a static
  // config redirect can't do — those are instead thin server-rendered pages
  // at the old paths that look up the city and permanentRedirect() (see
  // app/(public)/cities/**).
  async redirects() {
    return [
      { source: "/cities", destination: "/destinations", permanent: true },
      { source: "/admin/attraction", destination: "/admin/cities", permanent: true },
      { source: "/admin/attarction", destination: "/admin/cities", permanent: true },
      { source: "/admin/attractions", destination: "/admin/cities", permanent: true },
      { source: "/admin/article", destination: "/admin/articles", permanent: true },
      { source: "/admin/category", destination: "/admin/categories", permanent: true },
      { source: "/admin/destination", destination: "/admin/cities", permanent: true },
      { source: "/admin/destinations", destination: "/admin/cities", permanent: true },
      { source: "/admin/city", destination: "/admin/cities", permanent: true },
      { source: "/admin/user", destination: "/admin/users", permanent: true },
      { source: "/admin/contributor", destination: "/admin/users", permanent: true },
      { source: "/admin/contributors", destination: "/admin/users", permanent: true },
      { source: "/admin/subscriber", destination: "/admin/newsletter", permanent: true },
      { source: "/admin/subscribers", destination: "/admin/newsletter", permanent: true },
      { source: "/admin/point", destination: "/admin/points", permanent: true },
      { source: "/admin/ledger", destination: "/admin/points", permanent: true },
      { source: "/admin/role", destination: "/admin/roles", permanent: true },
      { source: "/admin/permission", destination: "/admin/roles", permanent: true },
      { source: "/admin/permissions", destination: "/admin/roles", permanent: true },
      { source: "/admin/setting", destination: "/admin/settings", permanent: true },
    ];
  },
};

export default nextConfig;
