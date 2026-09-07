import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getAboutPageConfig, setAboutPageConfig, type AboutPageConfig } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const config = await getAboutPageConfig();
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || typeof body.heading !== "string") {
    return NextResponse.json({ error: "Invalid about page config." }, { status: 400 });
  }

  try {
    const config = await setAboutPageConfig(body as AboutPageConfig);
    await logActivity(session, "about_page_updated", { type: "settings", id: "about-page", label: "About page" });
    revalidatePath("/about");
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
