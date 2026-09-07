import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { toggleSubscriberStatus, deleteSubscriber } from "@/lib/newsletter";
import { dbErrorMessage } from "@/lib/db";
import { requireApiPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "subscribers", "update");
  if (denied) return denied;

  try {
    const updated = await toggleSubscriberStatus(params.id);
    if (!updated) {
      return NextResponse.json({ error: "Subscriber not found." }, { status: 404 });
    }
    return NextResponse.json({ subscriber: updated });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  const denied = await requireApiPermission(session, "subscribers", "delete");
  if (denied) return denied;

  try {
    await deleteSubscriber(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
