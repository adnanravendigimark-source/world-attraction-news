import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getFooterConfig, setFooterConfig, type FooterConfig } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Backs Admin -> Footer: the whole public footer (About text, social links,
// link columns, copyright line) as one editable JSON blob. See
// lib/settings.ts's getFooterConfig()/setFooterConfig()/normalizeFooterConfig
// for the shape and defensive normalization.

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "footer", "read");
  if (denied) return denied;
  try {
    const config = await getFooterConfig();
    return NextResponse.json({ config });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiPermission(session, "footer", "update");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || typeof body.about !== "string") {
    return NextResponse.json({ error: "Invalid footer config." }, { status: 400 });
  }

  try {
    const config = await setFooterConfig(body as FooterConfig);
    await logActivity(session, "footer_updated", { type: "settings", id: "footer", label: "Public footer" });
    // The footer is rendered from the shared (public) route group layout, so
    // revalidating the root layout segment covers every public page.
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
