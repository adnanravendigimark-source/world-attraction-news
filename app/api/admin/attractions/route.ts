import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { getAttractions, createAttraction } from "@/lib/attractions";
import { getCityById } from "@/lib/cities";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { cityPath, attractionsPath } from "@/lib/destinations";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "attractions", "read");
  if (denied) return denied;
  try {
    const attractions = await getAttractions();
    return NextResponse.json({ attractions });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiPermission(session, "attractions", "create");
  if (denied) return denied;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const cityId = (body.cityId || "").trim();
  const name = (body.name || "").trim();
  if (!cityId) return NextResponse.json({ error: "Choose a city." }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  const city = await getCityById(cityId).catch(() => undefined);
  if (!city) return NextResponse.json({ error: "That city doesn't exist." }, { status: 400 });

  try {
    const attraction = await createAttraction({
      cityId,
      name,
      description: body.description || "",
      heroImage: body.heroImage || "",
      heroImageAlt: body.heroImageAlt || "",
      metaTitle: body.metaTitle || "",
      metaDescription: body.metaDescription || "",
      sortOrder: Number(body.sortOrder) || 0,
    });
    await logActivity(session, "attraction_created", { type: "attraction", id: attraction.id, label: `${attraction.name} (${city.name})` });
    revalidatePath(attractionsPath(city.countrySlug, city.slug));
    revalidatePath(cityPath(city.countrySlug, city.slug));
    revalidateTag("attractions");
    return NextResponse.json({ ok: true, attraction: { ...attraction, cityId: city.id, cityName: city.name } });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
