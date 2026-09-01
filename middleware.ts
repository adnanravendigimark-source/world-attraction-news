import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

// Gates:
//   /dashboard/*      -> any logged-in "contributor" (approved, checked at
//                         login time — the session itself is only ever
//                         issued to an approved contributor or an admin)
//   /admin/*           -> role "admin" only
//   /api/dashboard/*   -> same as /dashboard
//   /api/admin/*       -> same as /admin
// The contributor-facing auth pages (/login, /signup, /pending-approval,
// /forgot-password, /reset-password) live OUTSIDE /dashboard on purpose —
// they need to be reachable while logged out, and putting them under
// /dashboard would mean special-casing them here. Only the admin login
// stays under /admin and needs that special-case.
const PUBLIC_PATHS = ["/admin/login"];

function withNoIndex(res: NextResponse) {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

// Every content page reads from the database on every request — without an
// explicit Cache-Control header the browser can still reuse a stale cached
// HTML response on a normal reload, so an admin publish/edit only visibly
// showed up after a hard refresh. Applied site-wide via this middleware so
// a normal refresh is always enough (learned from earlier projects).
function withNoCache(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isDashboardArea = pathname.startsWith("/dashboard") || pathname.startsWith("/api/dashboard");
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isProtectedArea = isDashboardArea || isAdminArea;

  if (!isProtectedArea) {
    return withNoCache(NextResponse.next());
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
    return withNoCache(withNoIndex(NextResponse.redirect(new URL("/", req.url))));
  }

  if (isDashboardArea && session.role !== "contributor" && session.role !== "admin") {
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
