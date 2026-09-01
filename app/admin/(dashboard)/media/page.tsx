import type { Metadata } from "next";
import { getMediaLibrary } from "@/lib/media";
import MediaLibraryManager from "@/components/admin/MediaLibraryManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Media Library", robots: { index: false, follow: false } };

export default async function AdminMediaPage() {
  const items = await getMediaLibrary();
  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink-900">Media Library</h1>
      <p className="mt-1 text-sm text-ink-600">
        Every image ever uploaded through the contributor dashboard or Admin Panel — all automatically optimized to
        WebP and capped at 2000px on upload. Upload new images from any cover-image field; this page is for
        managing what's already here.
      </p>
      <div className="mt-6">
        <MediaLibraryManager initialItems={items} />
      </div>
    </div>
  );
}
