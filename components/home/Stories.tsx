import Image from "next/image";
import Link from "next/link";
import type { ArticleWithRelations } from "@/lib/articles";
import { storyDate, storyHref, storyKicker } from "@/lib/home";

type Story = ArticleWithRelations;

export function Kicker({ story, className = "" }: { story: Story; className?: string }) {
  const k = storyKicker(story);
  return (
    <p className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] ${className}`}>
      {k.breaking ? (
        <span className="inline-flex items-center gap-1.5 text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
          Breaking
        </span>
      ) : (
        <span className={story.type === "news" ? "text-signal" : "text-ink-900"}>{k.label}</span>
      )}
      {k.place && (
        <>
          <span className="text-ink-300" aria-hidden="true">·</span>
          <span className="text-ink-500">{k.place}</span>
        </>
      )}
    </p>
  );
}

export function Meta({ story, className = "" }: { story: Story; className?: string }) {
  const parts = [storyDate(story.publishedAt), story.readingTimeMinutes ? `${story.readingTimeMinutes} min read` : ""].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className={`text-[13px] text-ink-500 ${className}`}>{parts.join(" · ")}</p>;
}

function Photo({ story, sizes, priority = false, className = "" }: { story: Story; sizes: string; priority?: boolean; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-paper-200 ${className}`}>
      {story.image && (
        <Image
          src={story.image}
          alt={story.imageAlt || story.title}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
      )}
    </div>
  );
}

const titleHover = "transition-colors group-hover:text-ink-600";

// The big story at the top of the page.
export function LeadStory({ story, wide = false }: { story: Story; wide?: boolean }) {
  return (
    <Link href={storyHref(story)} className={`group grid gap-5 ${wide ? "lg:grid-cols-12 lg:items-center lg:gap-10" : ""}`}>
      <Photo
        story={story}
        priority
        sizes={wide ? "(min-width: 1024px) 58vw, 100vw" : "(min-width: 1024px) 64vw, 100vw"}
        className={`aspect-[16/9] ${wide ? "lg:col-span-7" : "lg:aspect-[2/1]"}`}
      />
      <div className={wide ? "lg:col-span-5" : ""}>
        <Kicker story={story} />
        <h2 className={`mt-3 font-serif text-[2rem] font-semibold leading-[1.08] tracking-tight text-ink-950 sm:text-[2.5rem] lg:text-[2.75rem] ${titleHover}`}>
          {story.title}
        </h2>
        {story.excerpt && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-600 line-clamp-3">{story.excerpt}</p>}
        <Meta story={story} className="mt-4" />
      </div>
    </Link>
  );
}

// A smaller story beside the lead.
export function SideStory({ story }: { story: Story }) {
  return (
    <Link href={storyHref(story)} className="group grid grid-cols-[1fr_7.5rem] gap-4 sm:grid-cols-[1fr_10rem] lg:grid-cols-1">
      <Photo story={story} sizes="(min-width: 1024px) 30vw, 160px" className="order-2 aspect-square lg:order-1 lg:aspect-[16/10]" />
      <div className="order-1 lg:order-2">
        <Kicker story={story} />
        <h3 className={`mt-2 font-serif text-xl font-semibold leading-snug tracking-tight text-ink-950 lg:text-[1.4rem] ${titleHover}`}>
          {story.title}
        </h3>
        <Meta story={story} className="mt-2" />
      </div>
    </Link>
  );
}

// A card in a section grid.
export function StoryCard({ story, sizes, large = false }: { story: Story; sizes: string; large?: boolean }) {
  return (
    <Link href={storyHref(story)} className="group flex flex-col">
      <Photo story={story} sizes={sizes} className={large ? "aspect-[16/9]" : "aspect-[3/2]"} />
      <Kicker story={story} className="mt-4" />
      <h3 className={`mt-2 font-serif font-semibold leading-snug tracking-tight text-ink-950 ${large ? "text-[1.5rem]" : "text-xl"} ${titleHover}`}>{story.title}</h3>
      {story.excerpt && <p className="mt-2 text-[15px] leading-relaxed text-ink-600 line-clamp-2">{story.excerpt}</p>}
      <Meta story={story} className="mt-3" />
    </Link>
  );
}

// Lays out 1–4 stories so the row never looks half empty: one story is a
// wide feature, two sit side by side, three or four fill a grid.
export function StoryGrid({ stories }: { stories: Story[] }) {
  if (stories.length === 0) return null;
  if (stories.length === 1) {
    const s = stories[0];
    return (
      <Link href={storyHref(s)} className="group grid gap-6 md:grid-cols-12 md:items-center md:gap-10">
        <Photo story={s} sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[16/10] md:col-span-7" />
        <div className="md:col-span-5">
          <Kicker story={s} />
          <h3 className={`mt-3 font-serif text-[1.75rem] font-semibold leading-tight tracking-tight text-ink-950 sm:text-[2rem] ${titleHover}`}>{s.title}</h3>
          {s.excerpt && <p className="mt-3 text-[17px] leading-relaxed text-ink-600 line-clamp-3">{s.excerpt}</p>}
          <Meta story={s} className="mt-4" />
        </div>
      </Link>
    );
  }
  const cols = stories.length === 2 ? "md:grid-cols-2 md:gap-x-10" : stories.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4";
  const sizes =
    stories.length === 2 ? "(min-width: 768px) 50vw, 100vw" : stories.length === 3 ? "(min-width: 768px) 33vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw";
  return (
    <div className={`grid grid-cols-1 gap-x-8 gap-y-12 ${cols}`}>
      {stories.map((s) => (
        <StoryCard key={s.id} story={s} sizes={sizes} large={stories.length === 2} />
      ))}
    </div>
  );
}

export function SectionHeader({ title, description, href, linkLabel }: { title: string; description?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 border-b border-ink-100 pb-4 sm:mb-10">
      <div>
        <h2 className="font-serif text-[1.75rem] font-semibold leading-tight tracking-tight text-ink-950 sm:text-[2rem]">{title}</h2>
        {description && <p className="mt-1.5 text-[15px] text-ink-500">{description}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-ink-900">
          <span className="underline-offset-4 group-hover:underline">{linkLabel}</span>
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      )}
    </div>
  );
}
