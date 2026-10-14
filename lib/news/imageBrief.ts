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

export const IMAGE_BRIEF_VERSION = "image-brief-2026-10-14";

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

const SYSTEM = `You write the visual brief for ONE realistic editorial travel photograph that will sit next to a passage of a travel article.
Rules:
- Show the real place the PASSAGE is about. Name it exactly as the passage or the destination names it (for example a district, square, street, park, river or building it mentions).
- Never show or name a place, landmark or building the passage, headline and destination do not mention, even if it is famous.
- Choose a real, plausible vantage point and the light (time of day, season if the passage gives one). Describe what is in the frame: the place, its typical architecture or landscape, a few people far away or from behind at most.
- No text, signs, logos, maps, cards, graphics or collage; one photograph.
- Do not depict accidents, conflict, damage or emergencies; show the place calmly.
- Start with the place's name (for example "Gràcia district, Barcelona: ..."). Capitalise only real place names.
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
