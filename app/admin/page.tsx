import { redirect } from "next/navigation";

// Bare /admin has no page of its own — the Overview dashboard lives at the
// explicit /admin/overview, matching every other Admin Panel section
// (/admin/articles, /admin/users, etc.) instead of being a special-cased
// index. This keeps old bookmarks/links to plain /admin working.
export default function AdminRootRedirect() {
  redirect("/admin/overview");
}
