import { redirect } from "next/navigation";

// Moved to /dashboard/articles/[id]/edit. This stub only exists so old
// bookmarks/links still land somewhere useful.
export default function LegacyEditArticleRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard/articles/${params.id}/edit`);
}
