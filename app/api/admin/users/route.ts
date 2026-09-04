import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUsers, createContributorByAdmin } from "@/lib/users";
import { dbErrorMessage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const users = await getUsers();
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: dbErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    if (!body.email || !body.displayName) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }
    const user = await createContributorByAdmin({
      email: body.email.trim(),
      displayName: body.displayName.trim(),
      password: body.password || undefined,
      bio: body.bio?.trim() || "",
      role: body.role === "admin" ? "admin" : "contributor",
      status: body.status === "pending" ? "pending" : "approved",
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || dbErrorMessage(err) }, { status: 400 });
  }
}
