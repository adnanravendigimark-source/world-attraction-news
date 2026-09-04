import { NextResponse } from "next/server";
import { createContactMessage } from "@/lib/contactMessages";
import { sendContactNotificationEmail } from "@/lib/email";
import { dbErrorMessage } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  // Unauthenticated, no honeypot alone is enough — a bot that skips the
  // hidden field would otherwise be free to fire unlimited DB writes and
  // outbound notification emails through this route.
  const ip = getClientIp(req);
  const limit = await checkRateLimit(`contact:${ip}`, 5, 3600);
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

  // Honeypot — a real visitor never fills in this hidden field; a bot
  // filling every field on the form will. Silently "succeed" instead of
  // telling the bot what tripped it.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim();
  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();

  if (!name) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return NextResponse.json({ error: "Please enter a message (at least 10 characters)." }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Message is too long (5000 characters max)." }, { status: 400 });
  }

  try {
    await createContactMessage({ name, email, subject, message });
    await sendContactNotificationEmail({ name, email, subject, message });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
