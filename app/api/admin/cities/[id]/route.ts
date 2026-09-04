import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getCityById, updateCity, deleteCity } from "@/lib/cities";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

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

  if (body.slug !== undefined && !/^[a-z0-9-]+$/.test(String(body.slug).toLowerCase())) {
    return NextResponse.json({ error: "Slug must be lowercase letters, numbers, and hyphens only." }, { status: 400 });
  }

  const before = await getCityById(params.id).catch(() => undefined);
  try {
    const city = await updateCity(params.id, {
      slug: body.slug !== undefined ? String(body.slug).trim().toLowerCase() : undefined,
      name: body.name !== undefined ? body.name : undefined,
      country: body.country !== undefined ? body.country : undefined,
      heroImage: body.heroImage !== undefined ? body.heroImage : undefined,
      heroImageAlt: body.heroImageAlt !== undefined ? body.heroImageAlt : undefined,
      intro: body.intro !== undefined ? body.intro : undefined,
      metaTitle: body.metaTitle !== undefined ? body.metaTitle : undefined,
      metaDescription: body.metaDescription !== undefined ? body.metaDescription : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });
    await logActivity(session, "city_edited", { type: "city", id: city.id, label: city.name });
    revalidatePath("/cities");
    revalidatePath(`/cities/${city.slug}`);
    revalidatePath(`/cities/${city.slug}/attractions`);
    if (before && before.slug !== city.slug) revalidatePath(`/cities/${before.slug}`);
    revalidatePath("/");
    revalidatePath("/about");
    return NextResponse.json({ ok: true, city });
  } catch (err) {
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
  const before = await getCityById(params.id).catch(() => undefined);
  try {
    await deleteCity(params.id);
    if (before) {
      await logActivity(session, "city_deleted", { type: "city", id: params.id, label: before.name });
      revalidatePath("/cities");
      revalidatePath(`/cities/${before.slug}`);
      revalidatePath("/");
      revalidatePath("/about");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
