import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSettings, updateSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
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
    const settings = await updateSettings({
      defaultMetaDescription: body.defaultMetaDescription !== undefined ? body.defaultMetaDescription : undefined,
      defaultOgImage: body.defaultOgImage !== undefined ? body.defaultOgImage : undefined,
      robotsDefault: body.robotsDefault === "noindex" ? "noindex" : body.robotsDefault === "index" ? "index" : undefined,
      featuredCitySlugs: Array.isArray(body.featuredCitySlugs) ? body.featuredCitySlugs : undefined,
      gaMeasurementId: body.gaMeasurementId !== undefined ? body.gaMeasurementId : undefined,
      gscVerificationCode: body.gscVerificationCode !== undefined ? body.gscVerificationCode : undefined,
    });
    const isSeoSave =
      body.defaultMetaDescription !== undefined ||
      body.defaultOgImage !== undefined ||
      body.robotsDefault !== undefined ||
      body.gaMeasurementId !== undefined ||
      body.gscVerificationCode !== undefined;
    await logActivity(session, "settings_updated", {
      type: "settings",
      id: "1",
      label: isSeoSave ? "SEO settings" : "Site settings",
    });
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}
