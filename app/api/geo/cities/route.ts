import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { searchCities } from "@/lib/geo";

export const dynamic = "force-dynamic";

// City/country autocomplete shared by Admin's "Add Destination" form and
// the Contributor article editor's "Other" destination field — both are
// logged-in-only surfaces, so this just requires *some* valid session
// (admin or contributor) rather than duplicating a role check that doesn't
// apply here; there's no data behind this endpoint that's sensitive per
// role, only the bundled city dataset itself (see lib/geo.ts).
//
// A 2-character minimum avoids doing a full dataset scan (and rendering an
// unhelpfully huge dropdown) on every single keystroke starting from an
// empty field — the client additionally debounces its own requests, so this
// is defense in depth, not the only thing limiting request volume.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchCities(q, 10);
  return NextResponse.json({ results });
}
