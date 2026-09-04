import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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

  if (body.slug !== undefined && !/^[a-z0-9-]+$/.test(String(body.slug).toLowerCase())) {
    return NextResponse.json({ error: "Slug must be lowercase letters, numbers, and hyphens only." }, { status: 400 });
  }

  try {
    const category = await updateCategory(params.id, {
      slug: body.slug !== undefined ? String(body.slug).trim().toLowerCase() : undefined,
      name: body.name !== undefined ? body.name : undefined,
      description: body.description !== undefined ? body.description : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });
    await logActivity(session, "category_edited", { type: "category", id: category.id, label: category.name });
    revalidatePath("/categories");
    return NextResponse.json({ ok: true, category });
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
  const before = await getCategoryById(params.id).catch(() => undefined);
  try {
    await deleteCategory(params.id);
    if (before) {
      await logActivity(session, "category_deleted", { type: "category", id: params.id, label: before.name });
      revalidatePath("/categories");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : dbErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
