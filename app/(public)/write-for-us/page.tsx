import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { SITE_NAME, CONTACT_EMAIL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: `Write for Us — Contributor Wire & Journalism Program | ${SITE_NAME}`,
  description: `Join the ${SITE_NAME} global correspondent network. Report on attraction openings, theme park developments, and destination intelligence.`,
  path: "/write-for-us",
});

const breadcrumbs = [
  { name: "Home", path: "/" },
  { name: "Write for Us", path: "/write-for-us" },
];

const STEPS = [
  {
    num: "01",
    title: "Apply for Bureau Access",
    body: "Sign up and declare your destination beat. Our editorial desk verifies correspondent applications within 24 to 48 hours.",
  },
  {
    num: "02",
    title: "Draft in the Contributor Workspace",
    body: "Approved correspondents write directly inside our streamlined article composer with photo uploads and real-time word counting.",
  },
  {
    num: "03",
    title: "Fact & Originality Verification",
    body: "Internal checks ensure originality, verified facts, and first-hand local insights before review.",
  },
  {
    num: "04",
    title: "Editorial Review & Scoring",
    body: "Our editorial desk reviews your dispatch, provides actionable feedback, and assigns quality points toward your correspondent rank.",
  },
  {
    num: "05",
    title: "Global Publication & Syndication",
    body: "Once greenlit by an editor, your story is published across city dossiers, category feeds, live wire alerts, and newsletter dispatches.",
  },
];

const BENEFITS = [
  {
    icon: "🌍",
    title: "Global Byline & Reach",
    desc: "Your stories reach tens of thousands of travelers, theme park enthusiasts, and industry insiders worldwide.",
  },
  {
    icon: "📈",
    title: "Points & Contributor Ranking",
    desc: "Earn points for every approved dispatch, unlocking featured bureau status and priority assignments.",
  },
  {
    icon: "⚡",
    title: "Fast Editorial Feedback",
    desc: "Get prompt reviews from experienced travel editors who help polish and elevate your reporting.",
  },
];

export default function WriteForUsPage() {
  return (
    <div className="bg-white min-h-screen text-[#0B1527] pb-16">
      {/* =========================================
          1. BREADCRUMBS & HERO HEADER
      ========================================= */}
      <div className="border-b border-slate-100 bg-white pt-5 pb-8">
        <Container>
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-4">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
            <span>&gt;</span>
            <span className="text-slate-800">Write for Us</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left Title & Tagline */}
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-[#DC2626] animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-[#DC2626]">
                  CONTRIBUTOR PROGRAM
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-[#0B1527]">
                Write for {SITE_NAME}
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                We partner with knowledgeable local correspondents, hospitality researchers, and travel journalists worldwide to report on attractions and theme park news.
              </p>
            </div>

            {/* Right: Pitch Scoop Box */}
            <div className="relative rounded-xl border border-rose-100/80 bg-rose-50/40 p-4 sm:p-5 lg:w-[380px] overflow-hidden">
              <div className="absolute right-2 -bottom-4 opacity-15 pointer-events-none">
                <svg className="w-32 h-32 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>

              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0B1527]">
                Have a Breaking Scoop?
              </h3>
              <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                Direct tip-offs, ride testing leaks, or opening confirmations: email our fast desk.
              </p>
              <div className="mt-2.5">
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=News Scoop`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#DC2626] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-[#B91C1C] transition-colors shadow-sm"
                >
                  <span>Submit News Scoop</span>
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* =========================================
          2. BENEFITS GRID
      ========================================= */}
      <section className="py-10 border-b border-slate-100 bg-slate-50/50">
        <Container>
          <div className="grid gap-6 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col gap-2">
                <span className="text-2xl mb-1">{b.icon}</span>
                <h3 className="font-sans text-sm font-black text-[#0B1527]">{b.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* =========================================
          3. HOW IT WORKS (5 STEPS)
      ========================================= */}
      <section className="py-12">
        <Container>
          <div className="mb-8">
            <span className="text-xs font-black uppercase tracking-widest text-[#DC2626] mb-1 block">
              THE EDITORIAL PROCESS
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-black text-[#0B1527]">
              How Writing For Us Works
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
              >
                <span className="font-mono text-2xl font-black text-[#DC2626] mb-3 block">{s.num}</span>
                <h3 className="font-sans text-base font-black text-[#0B1527] mb-2">{s.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* =========================================
          4. SUBMISSION GUIDELINES & CTA
      ========================================= */}
      <section className="py-8">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Guidelines */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <h3 className="font-serif text-xl font-black text-[#0B1527] mb-3">
                  What We Cover
                </h3>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-600 leading-relaxed list-disc list-inside">
                  <li><strong className="text-slate-900">New Attractions &amp; Openings:</strong> First look photos, soft opening dates, and construction milestones.</li>
                  <li><strong className="text-slate-900">Ticket &amp; Pass Shifts:</strong> Pricing updates, annual pass restructuring, and queue reservation strategies.</li>
                  <li><strong className="text-slate-900">Theme Park Expansions:</strong> New themed lands, dark rides, roller coasters, and immersive shows.</li>
                  <li><strong className="text-slate-900">Museum &amp; Landmark Exhibits:</strong> Major restorations, special exhibitions, and visitor access policy changes.</li>
                </ul>
              </div>

              <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <h3 className="font-serif text-xl font-black text-[#0B1527] mb-3">
                  Originality Standards
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Every dispatch must represent original reporting written exclusively for {SITE_NAME}. We strictly prohibit spun content, unverified aggregator roundups, and AI filler text.
                </p>
              </div>
            </div>

            {/* Right: Apply CTA Card */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-slate-200 bg-[#0B1527] text-white p-6 sm:p-8 shadow-md flex flex-col gap-4 text-center">
                <span className="text-3xl">✍️</span>
                <h3 className="font-serif text-xl sm:text-2xl font-black text-white">
                  Join the Newsroom
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Start reporting on the attractions and destinations in your area. Create a contributor account to get started.
                </p>
                <Link
                  href="/signup"
                  className="w-full mt-2 rounded-lg bg-[#DC2626] py-3 text-xs font-black uppercase tracking-wider text-white shadow hover:bg-[#B91C1C] transition-colors"
                >
                  Apply as Contributor →
                </Link>
                <Link
                  href="/login"
                  className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Already a contributor? Log In
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)) }}
      />
    </div>
  );
}
