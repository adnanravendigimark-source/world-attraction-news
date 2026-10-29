"use client";

import { useEffect } from "react";

// Counts one view from the reader's browser via POST /api/articles/[id]/view,
// so the article page itself can be served from cache instead of writing to
// the DB on every request (crawlers included). The endpoint dedupes per IP
// (30-minute window) exactly as the old server-side call did.
export default function ArticleViewBeacon({ articleId }: { articleId: string }) {
  useEffect(() => {
    fetch(`/api/articles/${encodeURIComponent(articleId)}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [articleId]);
  return null;
}
