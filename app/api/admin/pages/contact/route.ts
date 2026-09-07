import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getContactPageConfig, setContactPageConfig, type ContactPageConfig } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "pages", "read");
  if (denied) return denied;
  try {
    const config = await getContactPageConfig();
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
  const denied = await requireApiPermission(session, "pages", "update");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || typeof body.heading !== "string") {
    return NextResponse.json({ error: "Invalid contact page config." }, { status: 400 });
  }

  try {
    const config = await setContactPageConfig(body as ContactPageConfig);
    await logActivity(session, "contact_page_updated", { type: "settings", id: "contact-page", label: "Contact page" });
    revalidatePath("/contact");
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
