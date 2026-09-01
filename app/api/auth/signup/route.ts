import { NextResponse } from "next/server";
import { registerContributor } from "@/lib/users";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public contributor signup — always creates role "contributor", status
// "pending". There is no way to reach role "admin" through this endpoint;
// admins can only be promoted from the Admin Panel by an existing admin.
export async function POST(req: Request) {
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

  return NextResponse.json({ ok: true });
}
