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
};

export default nextConfig;
