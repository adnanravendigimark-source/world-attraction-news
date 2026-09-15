import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  getSitemapById,
  updateSitemap,
  deleteSitemap,
  validateSitemapInput,
  getUrlsForSitemap,
} from "@/lib/sitemaps";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiPermission(session, "sitemaps", "update");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const current = await getSitemapById(params.id);
  if (!current) {
    return NextResponse.json({ error: "Sitemap not found." }, { status: 404 });
  }

  // Full validation only when name/type/path are actually being changed —
  // a bare { enabled } toggle (the table's Enabled/Disabled pill) shouldn't
  // have to re-pass path-format validation on data it isn't touching.
  if (body.name !== undefined || body.type !== undefined || body.path !== undefined) {
    const validationError = validateSitemapInput({
      name: body.name ?? current.name,
      type: body.type ?? current.type,
      path: body.path ?? current.path,
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

  try {
    const sitemap = await updateSitemap(params.id, {
      name: body.name !== undefined ? body.name : undefined,
      type: body.type !== undefined ? body.type : undefined,
      path: body.path !== undefined ? body.path : undefined,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
    });
    await logActivity(session, "sitemap_edited", { type: "sitemap", id: sitemap.id, label: sitemap.name });

    revalidatePath("/sitemap.xml");
    revalidatePath(current.path);
    revalidatePath(sitemap.path);

    const urls = await getUrlsForSitemap(sitemap);
    return NextResponse.json({ ok: true, sitemap, count: urls.length });
  } catch (err) {
    console.error("[api/admin/sitemaps/[id]] update error:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already exists")) return NextResponse.json({ error: message }, { status: 409 });
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiPermission(session, "sitemaps", "delete");
  if (denied) return denied;

  const before = await getSitemapById(params.id).catch(() => undefined);
  try {
    // Only removes the sitemaps config row (see lib/sitemaps.ts's
    // deleteSitemap) — countries/cities/categories/articles are never
    // touched by this call.
    await deleteSitemap(params.id);
    if (before) {
      await logActivity(session, "sitemap_deleted", { type: "sitemap", id: params.id, label: before.name });
      revalidatePath("/sitemap.xml");
      revalidatePath(before.path);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
