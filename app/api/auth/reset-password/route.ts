import { NextResponse } from "next/server";
import { consumePasswordResetToken } from "@/lib/users";
import { dbErrorMessage } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Limits brute-forcing a guessed/leaked reset token — 10 attempts per 30
  // minutes per IP. The token itself is still the real security boundary
  // (long, random, single-use, time-limited); this only slows down guessing.
  const ip = getClientIp(req);
  const limit = await checkRateLimit(`reset-password:${ip}`, 10, 1800);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const token = (body.token || "").trim();
  const password = body.password || "";

  if (!token) return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const success = await consumePasswordResetToken(token, password);
    if (!success) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
