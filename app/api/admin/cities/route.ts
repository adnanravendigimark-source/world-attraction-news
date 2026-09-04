import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { getCities, createCity } from "@/lib/cities";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const cities = await getCities();
    return NextResponse.json({ cities });
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
  const slug = (body.slug || "").trim().toLowerCase();
  const name = (body.name || "").trim();
  const country = (body.country || "").trim();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug must be lowercase letters, numbers, and hyphens only." }, { status: 400 });
  }
  if (!name || !country) {
    return NextResponse.json({ error: "Name and country are required." }, { status: 400 });
  }
  try {
    const city = await createCity({
      slug,
      name,
      country,
      heroImage: body.heroImage || "",
      heroImageAlt: body.heroImageAlt || "",
      intro: body.intro || "",
      metaTitle: body.metaTitle || "",
      metaDescription: body.metaDescription || "",
      sortOrder: Number(body.sortOrder) || 0,
    });
    await logActivity(session, "city_created", { type: "city", id: city.id, label: city.name });
    revalidatePath("/cities");
    revalidatePath("/");
    revalidatePath("/about"); // lists "Active Destination Bureaus"
    revalidateTag("cities");
    revalidateTag("homepage");
    return NextResponse.json({ ok: true, city });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already exists")) return NextResponse.json({ error: message }, { status: 409 });
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
