import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getFeaturedCitySlugs, setFeaturedCitySlugs } from "@/lib/settings";
import { getCities } from "@/lib/cities";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Backs Admin -> Destinations -> Top Destinations: an ordered list of city
// slugs an admin picked to appear in the public navbar's "Destinations"
// dropdown, replacing what used to be a hardcoded Paris/London/Rome/NYC list.

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const slugs = await getFeaturedCitySlugs();
    return NextResponse.json({ slugs });
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

  if (!Array.isArray(body.slugs) || body.slugs.some((s: unknown) => typeof s !== "string")) {
    return NextResponse.json({ error: "slugs must be an array of city slug strings." }, { status: 400 });
  }

  // Silently drop anything that isn't a real city slug — never let a typo'd
  // or stale entry (e.g. a since-deleted city) end up saved.
  const validSlugs = new Set((await getCities()).map((c) => c.slug));
  const slugs: string[] = body.slugs.filter((s: string) => validSlugs.has(s));

  try {
    await setFeaturedCitySlugs(slugs);
    // The dropdown is rendered from the shared (public) route group layout,
    // so every public page needs to pick up the change — revalidating the
    // root layout segment covers all of them in one call.
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, slugs });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
