import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { getAttractionById, updateAttraction, deleteAttraction } from "@/lib/attractions";
import { getCityById } from "@/lib/cities";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { cityPath, attractionsPath, attractionPath } from "@/lib/destinations";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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

  // The edit modal's "Destination City" dropdown was previously decorative
  // here — this route never read body.cityId, so re-assigning an attraction
  // to a different city looked saved (no error) but silently didn't happen.
  let cityId: string | undefined;
  if (body.cityId !== undefined) {
    const trimmed = String(body.cityId || "").trim();
    const city = await getCityById(trimmed).catch(() => undefined);
    if (!city) return NextResponse.json({ error: "That city doesn't exist." }, { status: 400 });
    cityId = trimmed;
  }

  const before = await getAttractionById(params.id).catch(() => undefined);
  try {
    const attraction = await updateAttraction(params.id, {
      cityId,
      name: body.name !== undefined ? body.name : undefined,
      description: body.description !== undefined ? body.description : undefined,
      heroImage: body.heroImage !== undefined ? body.heroImage : undefined,
      heroImageAlt: body.heroImageAlt !== undefined ? body.heroImageAlt : undefined,
      metaTitle: body.metaTitle !== undefined ? body.metaTitle : undefined,
      metaDescription: body.metaDescription !== undefined ? body.metaDescription : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });
    const withCity = await getAttractionById(attraction.id);
    await logActivity(session, "attraction_edited", { type: "attraction", id: attraction.id, label: attraction.name });
    if (withCity) {
      revalidatePath(attractionsPath(withCity.countrySlug, withCity.citySlug));
      revalidatePath(attractionPath(withCity.countrySlug, withCity.citySlug, withCity.slug));
      revalidatePath(cityPath(withCity.countrySlug, withCity.citySlug));
      // The city (and/or its country) may have changed — also refresh the
      // attraction's old home.
      if (before && (before.citySlug !== withCity.citySlug || before.countrySlug !== withCity.countrySlug)) {
        revalidatePath(attractionsPath(before.countrySlug, before.citySlug));
        revalidatePath(cityPath(before.countrySlug, before.citySlug));
      }
      revalidateTag("attractions");
    }
    return NextResponse.json({ ok: true, attraction: withCity ?? attraction });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const before = await getAttractionById(params.id).catch(() => undefined);
  try {
    await deleteAttraction(params.id);
    if (before) {
      await logActivity(session, "attraction_deleted", { type: "attraction", id: params.id, label: before.name });
      revalidatePath(attractionsPath(before.countrySlug, before.citySlug));
      revalidatePath(cityPath(before.countrySlug, before.citySlug));
      revalidateTag("attractions");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
