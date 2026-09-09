import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

// Gates:
//   /contributor/*     -> any logged-in "contributor" (approved, checked at
//                         login time — the session itself is only ever
//                         issued to an approved contributor or an admin)
//   /admin/*           -> role "admin" only
//   /api/dashboard/*   -> same as /contributor (the API routes kept their
//                         original /api/dashboard/* path — only the
//                         contributor-facing pages moved to /contributor —
//                         see components/dashboard/*.tsx for the fetch()
//                         call sites)
//   /api/admin/*       -> same as /admin
// The contributor-facing auth pages (/login, /signup, /pending-approval,
// /forgot-password, /reset-password) live OUTSIDE /contributor on purpose —
// they need to be reachable while logged out, and putting them under
// /contributor would mean special-casing them here. Only the admin login
// stays under /admin and needs that special-case.
//
// The legacy /dashboard/* routes (see app/dashboard/**) are plain
// redirect() stubs that forward old bookmarks to /contributor/* — they
// carry no protected data themselves, so /dashboard is deliberately left
// OUT of the protected areas below. Middleware just lets the request
// through to the stub, which redirects to the real /contributor/* path,
// which then gets gated on its own merits by the isContributorArea check.
const PUBLIC_PATHS = ["/admin/login", "/admin"];

function withNoIndex(res: NextResponse) {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

// Admin/Contributor pages carry session-specific, sensitive data (draft
// content, review queues, other users' info) — these must never be cached
// by the browser or any intermediary, including after logout (so the back
// button can't reveal a previous session's data on a shared machine).
function withNoCache(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

// Public pages intentionally do NOT get a blanket no-store here. Every
// public page already declares its own correct caching behavior (see each
// page.tsx's `dynamic`/`revalidate` export): pages with real-time filters
// stay fully dynamic, while the rest use time-boxed revalidation (ISR) plus
// on-demand revalidatePath() calls from the admin mutation routes that
// change them, so an edit shows up promptly without needing a hard refresh
// AND repeat visits still benefit from real caching. A middleware-wide
// no-store used to sit here for every public route — it silently discarded
// whatever caching each page opted into, which is the reason those earlier
// pages could never actually be cached no matter what they declared. Do not
// reintroduce a blanket override here; if a specific public route needs
// no-store, set it in that route's own headers/config instead.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isContributorArea = pathname.startsWith("/contributor") || pathname.startsWith("/api/dashboard");
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isProtectedArea = isContributorArea || isAdminArea;

  if (!isProtectedArea) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return withNoIndex(withNoCache(NextResponse.next()));
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  const isApi = pathname.startsWith("/api/");

  if (!session) {
    if (isApi) {
      return withNoCache(withNoIndex(NextResponse.json({ error: "Unauthorized" }, { status: 401 })));
    }
    const loginPath = isAdminArea ? "/admin/login" : "/login";
    const loginUrl = new URL(loginPath, req.url);
    loginUrl.searchParams.set("next", pathname);
    return withNoCache(withNoIndex(NextResponse.redirect(loginUrl)));
  }

  if (isAdminArea && session.role !== "admin") {
    if (isApi) {
      return withNoCache(withNoIndex(NextResponse.json({ error: "Admins only." }, { status: 403 })));
    }
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return withNoCache(withNoIndex(NextResponse.redirect(loginUrl)));
  }

  if (isContributorArea && session.role !== "contributor" && session.role !== "admin") {
    if (isApi) {
      return withNoCache(withNoIndex(NextResponse.json({ error: "Unauthorized" }, { status: 401 })));
    }
    return withNoCache(withNoIndex(NextResponse.redirect(new URL("/login", req.url))));
  }

  return withNoCache(withNoIndex(NextResponse.next()));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
