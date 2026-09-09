import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { getCategories, createCategory } from "@/lib/categories";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const denied = await requireApiPermission(session, "categories", "read");
  if (denied) return denied;
  try {
    const categories = await getCategories();
    return NextResponse.json({ categories });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const denied = await requireApiPermission(session, "categories", "create");
  if (denied) return denied;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const slug = (body.slug || "").trim().toLowerCase();
  const name = (body.name || "").trim();
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || !name) {
    return NextResponse.json({ error: "Name and a valid slug are required." }, { status: 400 });
  }
  try {
    const category = await createCategory({
      slug,
      name,
      description: body.description || "",
      image: body.image || "",
      imageAlt: body.imageAlt || "",
      metaTitle: body.metaTitle || "",
      metaDescription: body.metaDescription || "",
      sortOrder: Number(body.sortOrder) || 0,
    });
    await logActivity(session, "category_created", { type: "category", id: category.id, label: category.name });
    revalidatePath("/categories");
    revalidateTag("categories");
    return NextResponse.json({ ok: true, category });
  } catch (err) {
    console.error("[api/admin/categories] create error:", err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("already exists")) return NextResponse.json({ error: message }, { status: 409 });
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
