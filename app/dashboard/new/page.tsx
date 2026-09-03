import { redirect } from "next/navigation";

// Moved to /contributor/articles/new (draft-first editor with autosave —
// see components/dashboard/ArticleEditor.tsx). This stub only exists so old
// bookmarks/links still land somewhere useful.
export default function LegacyNewArticleRedirect() {
  redirect("/contributor/articles/new");
}
