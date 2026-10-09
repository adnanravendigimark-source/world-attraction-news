// Pure title-similarity helpers for Phase 4 deduplication / clustering.
// No DB, no network, so they are easy to unit test.

const STOP = new Set(
  (
    "a an the and or but of in on at to for from by with about as into over after before amid new newly " +
    "is are was were be been will would could may might can says say said announces announce announced announcing " +
    "launches launch launched unveils unveil reveals reveal plans plan set sets here what you need know all " +
    "this that these those its it their his her our your more most just now today report reports " +
    "why how when who which up out off than also still travel travelling traveling entry trip"
  ).split(" ")
);

// Collapse near-synonyms so differently worded headlines about one event match.
const SYNONYM: Record<string, string> = {
  rules: "rule", requirements: "rule", requirement: "rule", regulations: "rule", regulation: "rule", restrictions: "rule", restriction: "rule", policy: "rule", policies: "rule",
  tourists: "visitor", tourist: "visitor", travelers: "visitor", traveler: "visitor", travellers: "visitor", traveller: "visitor", visitors: "visitor", visitor: "visitor", passengers: "visitor", passenger: "visitor", holidaymakers: "visitor",
  changes: "change", changed: "change", changing: "change", updates: "change", revamp: "change", overhaul: "change",
  opens: "open", opened: "open", opening: "open", reopens: "open", reopened: "open", unveiled: "open",
  introduces: "introduce", introduced: "introduce", adds: "introduce", added: "introduce",
  bans: "ban", banned: "ban", banning: "ban",
  flights: "flight", airlines: "airline", airports: "airport", routes: "route", hotels: "hotel", cruises: "cruise",
  // Charges: "visitor fee" and "tourist tax" name the same thing.
  tax: "tax", taxes: "tax", fee: "tax", fees: "tax", levy: "tax", levies: "tax", charge: "tax", charges: "tax", surcharge: "tax", surcharges: "tax",
  increase: "increase", increases: "increase", increased: "increase", rises: "increase", rise: "increase", raised: "increase", raises: "increase", hike: "increase", hikes: "increase", hiked: "increase", higher: "increase",
  international: "international", foreign: "international", overseas: "international",
};

function stem(w: string): string {
  if (SYNONYM[w]) return SYNONYM[w];
  const ordinal = w.match(/^(\d+)(st|nd|rd|th)$/); // "15th" -> "15"
  if (ordinal) return ordinal[1];
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}


// Places that make two otherwise-similar headlines DIFFERENT stories
// ("Japan updates entry rules" vs "Thailand updates entry rules"). Not
// exhaustive: it only needs to cover the common travel-news subjects.
const GEO = new Set(
  (
    "afghanistan albania algeria argentina armenia aruba australia austria azerbaijan bahamas bahrain bali bangladesh barbados belgium belize bhutan bolivia bosnia botswana brazil britain brunei bulgaria cambodia cameroon canada chile china colombia croatia cuba cyprus czechia denmark dominican ecuador egypt england estonia ethiopia fiji finland france georgia germany ghana greece greenland guatemala hawaii honduras hungary iceland india indonesia iran iraq ireland israel italy jamaica japan jordan kazakhstan kenya korea kosovo kuwait laos latvia lebanon libya lithuania luxembourg macau madagascar malaysia maldives malta mexico moldova monaco mongolia montenegro morocco myanmar namibia nepal netherlands zealand nicaragua nigeria norway oman pakistan palestine panama paraguay peru philippines poland portugal qatar romania russia rwanda samoa saudi scotland senegal serbia seychelles singapore slovakia slovenia somalia spain sri sweden switzerland syria taiwan tanzania thailand tunisia turkey uganda ukraine emirates uk usa america uruguay uzbekistan vanuatu vatican venezuela vietnam wales yemen zambia zimbabwe " +
    "amsterdam athens atlanta bangkok barcelona beijing berlin bologna boston brussels budapest cairo cancun chicago copenhagen delhi denver dubai dublin edinburgh florence frankfurt geneva hanoi helsinki istanbul jakarta jerusalem kyoto lima lisbon london angeles madrid manchester manila marrakech melbourne miami milan moscow mumbai munich naples nice orlando osaka oslo paris phuket prague reykjavik rio rome salzburg seoul seville shanghai sydney tokyo toronto vancouver venice vienna warsaw washington zurich pompeii santorini mykonos tenerife ibiza mallorca majorca sicily sardinia tuscany provence " +
    "eiffel louvre colosseum vatican alhambra sagrada stonehenge versailles disneyland disney universal legoland machu picchu petra acropolis parthenon taj mahal burj khalifa fuji angkor wat kremlin hermitage prado uffizi guggenheim sistine pantheon " +
    "ryanair easyjet lufthansa emirates qantas delta united american southwest jetblue ba iberia klm swiss turkish etihad singapore cathay ana jal vueling wizz norwegian heathrow gatwick schiphol jfk lax changi"
  ).split(/\s+/)
);

function isSentenceCase(title: string): boolean {
  const words = title.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && w.length > 3);
  if (words.length < 3) return false;
  const caps = words.filter((w) => /^[A-Z]/.test(w)).length;
  return caps / words.length < 0.6;
}

// Entity tokens: known places/brands, plus (for sentence-case titles) any
// capitalised word after the first.
export function entities(title: string): Set<string> {
  const out = new Set<string>();
  const clean = title.replace(/\s[-–—|]\s[^-–—|]{2,40}$/, "").replace(/[’']s\b/g, "");
  const words = clean.split(/\s+/);
  const sentenceCase = isSentenceCase(clean);
  words.forEach((raw, idx) => {
    const w = raw.replace(/[^\p{L}\p{N}]/gu, "");
    if (!w) return;
    const lw = w.toLowerCase();
    if (GEO.has(lw)) out.add(lw);
    else if (sentenceCase && idx > 0 && /^[A-Z]/.test(w) && w.length > 2 && !STOP.has(lw)) out.add(lw);
  });
  return out;
}

// Both titles name entities but none in common → different events.
export function entityConflict(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  for (const e of a) if (b.has(e)) return false;
  return true;
}

export function titleTokens(title: string): Set<string> {
  const out = new Set<string>();
  const cleaned = title
    .toLowerCase()
    // Strip a trailing " - Publisher" / " | Publisher" suffix (Google News style).
    .replace(/\s[-–—|]\s[^-–—|]{2,40}$/, "")
    .replace(/[’']s\b/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  for (const raw of cleaned.split(/\s+/)) {
    if (!raw || raw.length < 2 || STOP.has(raw)) continue;
    const s = stem(raw);
    if (s.length >= 2 && !STOP.has(s)) out.add(s);
  }
  return out;
}

export function similarity(a: Set<string>, b: Set<string>): { jaccard: number; overlap: number; shared: number } {
  if (a.size === 0 || b.size === 0) return { jaccard: 0, overlap: 0, shared: 0 };
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  const union = a.size + b.size - shared;
  return { jaccard: shared / union, overlap: shared / Math.min(a.size, b.size), shared };
}

// Same event if the headlines share most of their meaningful words and don't
// name conflicting places/brands.
export interface PreparedTitle {
  tokens: Set<string>;
  ents: Set<string>;
  lead: string; // the headline's first word when it is a capitalised name ("Belgrade", "Lufthansa")
}

// Headlines usually open with their subject. A capitalised first word that
// isn't a stop word is taken as a name, which covers places and brands that
// aren't in the GEO list.
export function leadName(title: string): string {
  const first = title.replace(/\s[-–—|]\s[^-–—|]{2,40}$/, "").trim().split(/\s+/)[0] || "";
  const w = first.replace(/[’']s$/, "").replace(/[^\p{L}\p{N}]/gu, "");
  if (w.length < 3 || !/^\p{Lu}/u.test(w)) return "";
  const lw = w.toLowerCase();
  return STOP.has(lw) || SYNONYM[lw] ? "" : lw;
}

export function prepareTitle(title: string): PreparedTitle {
  return { tokens: titleTokens(title), ents: entities(title), lead: leadName(title) };
}

export function sameStoryPrepared(x: PreparedTitle, y: PreparedTitle): boolean {
  if (entityConflict(x.ents, y.ents)) return false;
  const { jaccard, overlap, shared } = similarity(x.tokens, y.tokens);
  const min = Math.min(x.tokens.size, y.tokens.size);
  if (jaccard >= 0.5 || (shared >= 3 && overlap >= 0.67) || (shared >= 2 && overlap >= 0.66 && min <= 4)) return true;
  // Differently worded headlines about one event: both name the same place
  // or brand and share at least four key words (e.g. "Belgrade increases
  // visitor fee ... October 15" / "Belgrade introduces new tourist tax: From
  // October 15th").
  let sharedEntity = !!x.lead && x.lead === y.lead;
  for (const e of x.ents) if (y.ents.has(e)) sharedEntity = true;
  return sharedEntity && shared >= 4 && overlap >= 0.5;
}

export function sameStoryTitles(titleA: string, titleB: string): boolean {
  return sameStoryPrepared(prepareTitle(titleA), prepareTitle(titleB));
}

// Strip tracking params, www, fragments and trailing slashes so the same page
// linked from two feeds compares equal. Google News redirect links can't be
// resolved offline, so those are returned as-is.
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.replace(/^www\./, "");
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref$|source$|cmpid)/i.test(k)) u.searchParams.delete(k);
    }
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}
