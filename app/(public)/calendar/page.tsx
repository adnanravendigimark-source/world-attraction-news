import type { Metadata } from "next";
import CalendarClient from "./CalendarClient";
import { SITE_NAME } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: `Calendar — Attraction Events, Festivals & Openings | ${SITE_NAME}`,
  description:
    "Your comprehensive global calendar of theme park events, festivals, new ride openings, and landmark celebrations worldwide.",
  path: "/calendar",
});

export default function CalendarPage() {
  return <CalendarClient />;
}
