import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getFeaturedCategorySlugs, setFeaturedCategorySlugs } from "@/lib/settings";
import { getCategories } from "@/lib/categories";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Backs Admin -> Header -> Top Categories: an ordered list of category
// slugs an admin picked to appear in the public navbar's "Categories"
// dropdown. Mirrors app/api/admin/featured-destinations/route.ts exactly.

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "header", "read");
  if (denied) return denied;
  try {
    const slugs = await getFeaturedCategorySlugs();
    return NextResponse.json({ slugs });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "header", "update");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!Array.isArray(body.slugs) || body.slugs.some((s: unknown) => typeof s !== "string")) {
    return NextResponse.json({ error: "slugs must be an array of category slug strings." }, { status: 400 });
  }

  // Silently drop anything that isn't a real category slug.
  const validSlugs = new Set((await getCategories()).map((c) => c.slug));
  const slugs: string[] = body.slugs.filter((s: string) => validSlugs.has(s));

  try {
    await setFeaturedCategorySlugs(slugs);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, slugs });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
