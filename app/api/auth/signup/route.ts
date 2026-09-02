import { NextResponse } from "next/server";
import { registerContributor } from "@/lib/users";
import { sendWelcomeEmail } from "@/lib/email";
import { dbErrorMessage } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Public contributor signup — always creates role "contributor", status
// "pending". There is no way to reach role "admin" through this endpoint;
// admins can only be promoted from the Admin Panel by an existing admin.
export async function POST(req: Request) {
  // Limits automated mass account creation — 5 signups per hour per IP.
  const ip = getClientIp(req);
  const limit = await checkRateLimit(`signup:${ip}`, 5, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts from this connection. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email || "").trim();
  const password = body.password || "";
  const displayName = (body.displayName || "").trim();
  const bio = (body.bio || "").trim();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }

  try {
    await registerContributor({ email, password, displayName, bio });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already exists")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }

  // Fire only after the account row exists. Never allowed to fail the
  // signup response itself — sendWelcomeEmail already never throws, but
  // this extra try/catch is defense in depth.
  try {
    await sendWelcomeEmail(email, displayName);
  } catch (err) {
    console.error("[signup] welcome email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
