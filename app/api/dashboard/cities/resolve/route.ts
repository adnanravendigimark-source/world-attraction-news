import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { resolveOrCreateCity } from "@/lib/cities";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

// Backs the Contributor article editor's Destination -> "Other" flow (see
// components/dashboard/ArticleEditor.tsx): the contributor picks a
// city/country via the same CityAutocomplete + worldCities dataset the
// admin Add Destination form uses, and this turns that selection into a
// real cityId to save the article against — reusing an existing city when
// one already matches, otherwise creating a minimal new one. Requires any
// signed-in session (contributor or admin), same as the geo/cities search
// endpoint it pairs with.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const city = String(body.city || "").trim();
  const country = String(body.country || "").trim();
  if (!city || !country) {
    return NextResponse.json({ error: "A city and country are required." }, { status: 400 });
  }

  try {
    const resolved = await resolveOrCreateCity(city, country);
    // A brand-new city (not just a reused existing one) is now a real
    // destination — make sure it shows up on /destinations and its own
    // pages right away rather than waiting out the ISR window, same as an
    // admin-created city does.
    revalidatePath("/destinations");
    revalidateTag("cities");
    return NextResponse.json({ city: resolved });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
