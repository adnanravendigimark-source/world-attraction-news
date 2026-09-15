import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getSitemaps, createSitemap, validateSitemapInput, getUrlsForSitemap } from "@/lib/sitemaps";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "sitemaps", "read");
  if (denied) return denied;
  try {
    const sitemaps = await getSitemaps();
    return NextResponse.json({ sitemaps });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiPermission(session, "sitemaps", "create");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const validationError = validateSitemapInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const sitemap = await createSitemap({
      name: body.name,
      type: body.type,
      path: body.path,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
    });
    await logActivity(session, "sitemap_created", { type: "sitemap", id: sitemap.id, label: sitemap.name });

    // Master index + this sitemap's own child route both read live on every
    // request (force-dynamic, no-store — see app/sitemap.xml/route.ts), so
    // this revalidatePath is belt-and-suspenders rather than load-bearing.
    revalidatePath("/sitemap.xml");
    revalidatePath(sitemap.path);

    const urls = await getUrlsForSitemap(sitemap);
    return NextResponse.json({ ok: true, sitemap, count: urls.length });
  } catch (err) {
    console.error("[api/admin/sitemaps] create error:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already exists")) return NextResponse.json({ error: message }, { status: 409 });
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
