import { SITE_URL } from "@/lib/site";

export default function SeoPreview({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}) {
  const displayUrl = `${SITE_URL.replace(/^https?:\/\//, "")}${path === "/" ? "" : path}`;
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
        Google Preview
      </p>
      <p className="truncate text-sm text-stone-600">{displayUrl}</p>
      <p className="mt-0.5 truncate text-lg text-[#1a0dab]">
        {title || "Untitled page"}
      </p>
      <p className="mt-1 line-clamp-2 text-sm text-[#4d5156]">
        {description || "No meta description set yet — Google will generate one from the page content, which you can't control."}
      </p>
    </div>
  );
}
