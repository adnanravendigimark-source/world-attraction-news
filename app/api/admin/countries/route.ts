import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { getAllCountries, getCountryBySlug, upsertCountry, slugifyCountry } from "@/lib/countries";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { countryPath } from "@/lib/destinations";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "destinations", "read");
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  try {
    if (slug) {
      const country = await getCountryBySlug(slug);
      return NextResponse.json({ country: country || null });
    }
    const countries = await getAllCountries();
    return NextResponse.json({ countries });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // upsertCountry() creates-or-updates a country hub in one call (see
  // lib/countries.ts) — gated on "update" since this endpoint is only ever
  // reached from the Destinations admin page's Country Hubs editor, which
  // is framed to admins as editing country info, not a separate creation
  // flow.
  const denied = await requireApiPermission(session, "destinations", "update");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Country name is required." }, { status: 400 });
  }

  const slug = body.slug ? slugifyCountry(body.slug) : slugifyCountry(name);

  try {
    const country = await upsertCountry({
      name,
      slug,
      intro: body.intro || "",
      heroImage: body.heroImage || "",
      heroImageAlt: body.heroImageAlt || "",
      metaTitle: body.metaTitle || "",
      metaDescription: body.metaDescription || "",
    });

    await logActivity(session, "country_updated", { type: "country", id: country.id, label: country.name });
    revalidatePath("/destinations");
    revalidatePath(countryPath(country.slug));
    revalidatePath("/");
    revalidateTag("countries");
    revalidateTag("cities");

    return NextResponse.json({ ok: true, country });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
