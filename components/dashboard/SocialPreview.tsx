import { SITE_URL } from "@/lib/site";

export default function SocialPreview({
  title,
  description,
  image,
}: {
  title: string;
  description: string;
  image?: string;
}) {
  const domain = SITE_URL.replace(/^https?:\/\//, "");
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
        Social Share Preview
      </p>
      <div className="overflow-hidden rounded-lg border border-stone-200">
        <div className="aspect-[1.91/1] w-full bg-stone-100">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-stone-400">
              No image set — a plain link preview will show instead
            </div>
          )}
        </div>
        <div className="bg-stone-50 p-3">
          <p className="truncate text-[11px] uppercase tracking-wide text-stone-500">{domain}</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-stone-900">{title || "Untitled page"}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{description || "No description set."}</p>
        </div>
      </div>
    </div>
  );
}
