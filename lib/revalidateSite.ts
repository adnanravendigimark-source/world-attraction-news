import { revalidatePath, revalidateTag } from "next/cache";

// Public pages are cached (they no longer query Neon on every visit), so any
// change that can affect what the public sees must purge them. This purges
// every cached page plus the unstable_cache data tags used across the site.
// Pages then re-render lazily on their next visit. Called after successful
// admin content writes (withSiteRevalidate) and when the cron publishes
// scheduled articles.
const DATA_TAGS = ["articles", "categories", "cities", "countries", "homepage", "users"];

export function revalidateSite(): void {
  try {
    revalidatePath("/", "layout");
    for (const tag of DATA_TAGS) revalidateTag(tag);
  } catch (err) {
    console.error("[revalidate] failed to purge site cache", err);
  }
}

// Wraps a route handler: on a 2xx response, purge the site cache.
export function withSiteRevalidate<A extends unknown[]>(
  handler: (...args: A) => Promise<Response> | Response,
) {
  return async (...args: A): Promise<Response> => {
    const res = await handler(...args);
    if (res.ok) revalidateSite();
    return res;
  };
}
