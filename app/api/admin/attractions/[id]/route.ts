import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAttractionById, updateAttraction, deleteAttraction } from "@/lib/attractions";
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
  try {
    const attraction = await updateAttraction(params.id, {
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
    if (before) await logActivity(session, "attraction_deleted", { type: "attraction", id: params.id, label: before.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
