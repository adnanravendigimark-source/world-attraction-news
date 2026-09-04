import { NextResponse } from "next/server";
import { subscribeToNewsletter } from "@/lib/newsletter";
import { dbErrorMessage } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  // Same reasoning as /api/contact — unauthenticated write endpoint, the
  // honeypot alone doesn't stop a bot that skips it from hammering this
  // with junk emails.
  const ip = getClientIp(req);
  const limit = await checkRateLimit(`newsletter:${ip}`, 10, 3600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot, same pattern as /api/contact.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const source = typeof body.source === "string" ? body.source.slice(0, 40) : "";

  try {
    const result = await subscribeToNewsletter(email, source);
    return NextResponse.json({ ok: true, alreadySubscribed: result.alreadySubscribed });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
