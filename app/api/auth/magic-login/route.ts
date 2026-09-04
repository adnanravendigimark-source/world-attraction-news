import { NextResponse } from "next/server";
import { verifyMagicToken, createSessionToken, SESSION_COOKIE_NAME, type Session } from "@/lib/auth";
import { findUserById, touchLastLogin } from "@/lib/users";
import { getAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

// Magic login handler: authenticates a user directly via a signed token in email notifications
// (e.g. account approved email) and seamlessly redirects them to their destination (such as /contributor/profile).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const next = url.searchParams.get("next") || "/contributor/profile";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", getAppUrl(req)));
  }

  const payload = await verifyMagicToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login?error=expired_token", getAppUrl(req)));
  }

  const user = await findUserById(payload.userId);
  if (!user || user.role !== "contributor" || user.status !== "approved") {
    const errorParam =
      user?.status === "rejected"
        ? "account_rejected"
        : user?.status === "suspended"
        ? "account_suspended"
        : "unauthorized";
    return NextResponse.redirect(new URL(`/login?error=${errorParam}`, getAppUrl(req)));
  }

  await touchLastLogin(user.id);

  const session: Session = {
    userId: user.id,
    email: user.email,
    role: "contributor",
    displayName: user.displayName,
    cityId: user.cityId,
  };

  const sessionToken = await createSessionToken(session, 60 * 60 * 24 * 7); // 7 days

  const destination = payload.next || next || "/contributor/profile";
  const res = NextResponse.redirect(new URL(destination, getAppUrl(req)));
  res.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
