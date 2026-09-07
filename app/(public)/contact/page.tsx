import type { Metadata } from "next";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME, CONTACT_EMAIL } from "@/lib/site";
import { getContactPageConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildMetadata({
  title: `Contact Us | ${SITE_NAME}`,
  description: "Get in touch with the Attraction Travel News editorial team.",
  path: "/contact",
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }];

export default async function ContactPage() {
  const config = await getContactPageConfig();

  return (
    <Container className="py-14 sm:py-20">
      <Breadcrumbs items={breadcrumbs} />

      <div className="mt-6 text-center">
        <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#DC2626]">
          {config.badgeText}
        </span>
        <h1 className="mt-4 font-serif text-3xl font-black tracking-tight text-ink-900 sm:text-4xl">
          {config.heading}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-600">{config.subtitle}</p>
      </div>

      <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 sm:p-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DC2626] text-white shadow-md">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="mt-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
          {config.emailCardLabel}
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-2 inline-block text-xl sm:text-2xl font-black text-[#DC2626] hover:underline break-all"
        >
          {CONTACT_EMAIL}
        </a>
        <p className="mt-4 text-xs text-slate-500">{config.replyNote}</p>
      </div>
    </Container>
  );
}
