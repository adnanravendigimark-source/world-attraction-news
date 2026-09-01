import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getCategoryById, updateCategory, deleteCategory } from "@/lib/categories";
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
    const category = await updateCategory(params.id, {
      slug: body.slug !== undefined ? body.slug : undefined,
      name: body.name !== undefined ? body.name : undefined,
      description: body.description !== undefined ? body.description : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });
    await logActivity(session, "category_edited", { type: "category", id: category.id, label: category.name });
    return NextResponse.json({ ok: true, category });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const before = await getCategoryById(params.id).catch(() => undefined);
  try {
    await deleteCategory(params.id);
    if (before) await logActivity(session, "category_deleted", { type: "category", id: params.id, label: before.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
