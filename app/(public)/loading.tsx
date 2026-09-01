import Container from "@/components/Container";

// Shown by Next automatically while a public page's server data fetch is
// in flight during client-side navigation (App Router convention) — a
// generic card-grid skeleton that roughly matches the shape of most public
// pages here, so navigation never shows a blank white screen.
export default function PublicLoading() {
  return (
    <Container className="animate-pulse py-10 sm:py-14">
      <div className="h-3 w-40 rounded bg-ink-100" />
      <div className="mt-4 h-8 w-72 max-w-full rounded bg-ink-100" />
      <div className="mt-3 h-4 w-full max-w-lg rounded bg-ink-100" />

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-ink-100 bg-white">
            <div className="aspect-[4/3] w-full bg-ink-100" />
            <div className="space-y-2 p-4">
              <div className="h-2.5 w-16 rounded bg-ink-100" />
              <div className="h-4 w-full rounded bg-ink-100" />
              <div className="h-3 w-3/4 rounded bg-ink-100" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
