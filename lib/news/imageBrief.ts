// A short visual brief for an AI image, written from the text the image sits
// next to: which real place to show, from where, in what light. Without it
// the image model only gets a heading and a city ("Exploring Nearby
// Attractions", "Barcelona") and draws the city's most famous landmark,
// e.g. the Sagrada Família for a section about the Gràcia district.
//
// One small text-model call. The brief may only name places the text names
// (checked in code); otherwise it is dropped and the caller falls back to
// the plain prompt built from the headline (composeImagePrompt).

import { chatJson } from "./aiClient";
import { researchModel } from "./research";

export const IMAGE_BRIEF_VERSION = "image-brief-2026-10-28";

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Capitalised names in a brief ("Park Güell", "Plaça del Sol", "Gràcia").
// Words that start sentences or describe light/time are not names.
const NOT_NAMES = new Set(["a", "an", "the", "in", "on", "at", "from", "with", "early", "late", "morning", "evening", "afternoon", "golden", "soft", "warm", "wide", "view", "looking", "seen", "two", "one", "travellers", "travelers", "visitors", "people", "street", "streets", "spring", "summer", "autumn", "winter"]);
export function namesIn(text: string): string[] {
  const out: string[] = [];
  const re = /\b([A-ZÀ-Ý][\p{L}'’-]+(?:\s+(?:de|del|dels|la|las|los|di|da|du|des|of|the|y|i|e)?\s*[A-ZÀ-Ý][\p{L}'’-]+)*)/gu;
  for (const m of String(text || "").matchAll(re)) {
    const name = m[1].trim().replace(/['’]s$/i, ""); // "Park Güell's" -> "Park Güell"
    if (!NOT_NAMES.has(name.toLowerCase())) out.push(name);
  }
  return [...new Set(out)];
}

// True when every name in the brief appears in the source text (headline,
// destination or the passage). Pure; exported for tests.
export function briefIsGrounded(brief: string, source: string): boolean {
  const src = fold(source);
  const names = namesIn(brief);
  if (names.length === 0) return false; // a brief must name the real place
  return names.every((n) => fold(n).split(/\s+/).every((w) => w.length < 3 || src.includes(w)));
}

const SYSTEM = `You write the visual brief for ONE realistic editorial photograph that will sit next to a passage of a travel article. A reader must see at a glance that the photo shows what the passage says.
Rules:
- First decide what the PASSAGE is mainly about:
  a) A PLACE (a district, square, street, park, river, building, beach or landmark it names): show that real place.
  b) Something travellers DO or USE (applying for a visa, submitting documents, paying a fee or tax, checking in, security screening, boarding, buying tickets, queuing at a counter, a new rule or requirement): show that activity as an everyday scene in its real setting, for example "Visa application centre in New Delhi: a traveller's hands passing a passport and application forms across a service counter to a staff member, other applicants waiting on chairs in the background". Do NOT replace the activity with a building's exterior or a street view.
- Name the setting exactly as the passage, headline or destination names it. Never show or name a place, landmark or building they do not mention, even if it is famous.
- Choose a plausible vantage point and the light. People: hands, from behind or far away only; no recognisable faces.
- Documents, passports, screens and signs show no readable text. No flags, national emblems, logos, maps, graphics or collage; one photograph.
- Do not depict accidents, conflict, damage or emergencies.
- Start with the setting's name (for example "Gràcia district, Barcelona: ..." or "Visa application centre in New Delhi: ..."). Capitalise only real names.
- 1 to 2 sentences, at most 60 words.
Return JSON: {"scene": "..."}`;

export async function visualBrief(input: { title: string; destination: string; passage: string; articleId?: string }): Promise<string | null> {
  const passage = String(input.passage || "").replace(/\s+/g, " ").trim().slice(0, 1600);
  if (!passage || !process.env.OPENAI_API_KEY?.trim()) return null;
  try {
    const { json } = await chatJson({
      kind: "image_brief",
      log: { articleId: input.articleId, promptVersion: IMAGE_BRIEF_VERSION },
      model: researchModel(),
      temperature: 0.4,
      timeoutMs: 30_000,
      system: SYSTEM,
      user: `HEADLINE: ${input.title}\nDESTINATION: ${input.destination || "(not given)"}\nPASSAGE: ${passage}`,
    });
    const scene = String(json?.scene || "").replace(/\s+/g, " ").trim().slice(0, 400);
    if (scene.length < 20) return null;
    // Only places the article itself names.
    return briefIsGrounded(scene, `${input.title} ${input.destination} ${passage}`) ? scene : null;
  } catch {
    return null; // the caller uses the plain prompt
  }
}
