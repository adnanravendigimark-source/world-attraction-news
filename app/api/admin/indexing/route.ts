import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getIndexingOverview, setIndexing, setBulkIndexing, type IndexingPageType } from "@/lib/indexing";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const rows = await getIndexingOverview();
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  try {
    // Bulk array support
    if (Array.isArray(body.items)) {
      await setBulkIndexing(
        body.items.map((item: any) => ({
          key: item.key,
          type: item.type as IndexingPageType | undefined,
          label: item.label,
          url: item.url,
          noIndex: Boolean(item.noIndex),
          noFollow: Boolean(item.noFollow !== undefined ? item.noFollow : item.noIndex),
        }))
      );
      return NextResponse.json({ ok: true });
    }

    // Single item update
    if (!body.key) {
      return NextResponse.json({ error: "Missing required key." }, { status: 400 });
    }

    const noIndex = Boolean(body.noIndex);
    const noFollow = Boolean(body.noFollow !== undefined ? body.noFollow : body.noIndex);

    await setIndexing({
      key: body.key,
      type: body.type as IndexingPageType | undefined,
      label: body.label,
      url: body.url,
      noIndex,
      noFollow,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
