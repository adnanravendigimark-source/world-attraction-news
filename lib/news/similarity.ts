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
    "riyadh jeddah mecca medina doha muscat abu dhabi sharjah kuwait manama amman beirut tehran karachi lahore islamabad dhaka kathmandu colombo goa bengaluru bangalore chennai hyderabad kolkata nagpur pune jaipur agra kochi " +
    "ho chi minh saigon danang hue siem reap phnom penh vientiane yangon kuala lumpur penang langkawi cebu boracay palawan bali jakarta yogyakarta taipei hong kong macao busan jeju sapporo okinawa nagoya fukuoka hiroshima nara " +
    "auckland wellington queenstown perth brisbane adelaide cairns hobart darwin fiji tahiti " +
    "nairobi mombasa zanzibar cape johannesburg durban marrakesh casablanca fez tunis accra lagos abuja addis dakar kigali luxor aswan sharm hurghada " +
    "montreal quebec calgary ottawa halifax seattle portland francisco diego vegas phoenix dallas houston austin nashville orleans philadelphia baltimore pittsburgh detroit minneapolis honolulu maui anchorage burbank newark laguardia " +
    "havana cartagena bogota medellin quito cusco santiago valparaiso mendoza montevideo asuncion panama tulum oaxaca puerto vallarta cabo " +
    "porto faro madeira azores malaga granada valencia bilbao seville cordoba marseille lyon bordeaux strasbourg nantes lille cannes monaco genoa turin verona pisa siena amalfi capri dubrovnik split zagreb ljubljana " +
    "belgrade sarajevo skopje tirana sofia bucharest krakow gdansk wroclaw riga tallinn vilnius kyiv lviv minsk bratislava innsbruck hallstatt lucerne interlaken zermatt bruges ghent gent antwerp rotterdam hague " +
    "bergen tromso stockholm gothenburg malmo aarhus faroe lapland rovaniemi glasgow belfast cardiff bath york liverpool bristol cork galway " +
    "eiffel louvre colosseum vatican alhambra sagrada stonehenge versailles disneyland disney universal legoland machu picchu petra acropolis parthenon taj mahal burj khalifa fuji angkor wat kremlin hermitage prado uffizi guggenheim sistine pantheon " +
    "ryanair easyjet lufthansa emirates qantas delta united american southwest jetblue ba iberia klm swiss turkish etihad singapore cathay ana jal vueling wizz norwegian heathrow gatwick schiphol jfk lax changi"
  ).split(/\s+/)
);

// Capitalised words that are part of many names ("American Airlines",
// "Porter Airlines") and so identify nothing on their own.
const GENERIC_NAME_WORDS = new Set(
  "air airline airlines airways airport airports international hotel hotels resort resorts cruise cruises line lines group national park parks museum city new world travel tourism"
    .split(" ")
);

// Words that appear in every kind of travel story and so prove little.
const WEAK_WORDS = new Set(["change", "visitor", "rule", "introduce", "open", "increase", "first", "new", "update", "day", "week", "year"]);

// Opposite actions: "PAL cancels Riyadh flights" and "Flyadeal launches
// Riyadh flights" are different news even though they share a place.
const STOP_ACTION = /\b(cancel(?:s|led|ed|ling)?|suspend(?:s|ed)?|cuts?|axes|bans?|banned|clos(?:es|ed|ing)|clos(?:e)|halts?|halted|scraps?|scrapped|ends|ended|drops?|dropped)\b/i;
const START_ACTION = /\b(launch(?:es|ed)?|opens?|opened|introduc(?:es|ed|e)|adds?|added|resum(?:es|ed|e)|starts?|started|expands?|expanded|unveil(?:s|ed)?|debuts?)\b/i;

function actionOf(title: string): { stop: boolean; start: boolean } {
  return { stop: STOP_ACTION.test(title), start: START_ACTION.test(title) };
}

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
  // Hyphenated routes ("Manila-Riyadh") name two places.
  const words = clean.split(/[\s\-–—\/]+/);
  const sentenceCase = isSentenceCase(clean);
  words.forEach((raw, idx) => {
    const w = raw.replace(/[^\p{L}\p{N}]/gu, "");
    if (!w) return;
    const lw = w.toLowerCase();
    if (GEO.has(lw)) out.add(lw);
    else if (GENERIC_NAME_WORDS.has(lw) || SYNONYM[lw]) return;
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
  desc: Set<string>; // teaser words, used when a headline is too short to judge
  action: { stop: boolean; start: boolean };

  lead: string; // the headline's first word when it is a capitalised name ("Belgrade", "Lufthansa")
}

// Headlines usually open with their subject. A capitalised first word that
// isn't a stop word is taken as a name, which covers places and brands that
// aren't in the GEO list.
export function leadName(title: string): string {
  const words = title.replace(/\s[-–—|]\s[^-–—|]{2,40}$/, "").trim().split(/\s+/).slice(0, 2);
  for (const [i, raw] of words.entries()) {
    const w = raw.replace(/[’']s$/, "").replace(/[^\p{L}\p{N}]/gu, "");
    if (w.length < 3 || !/^\p{Lu}/u.test(w)) return "";
    const lw = w.toLowerCase();
    if (STOP.has(lw) || SYNONYM[lw]) return "";
    // "Air Canada", "New York": skip a generic first word and use the next.
    if (GENERIC_NAME_WORDS.has(lw)) {
      if (i === 0) continue;
      return "";
    }
    return lw;
  }
  return "";
}

export function prepareTitle(title: string, description = ""): PreparedTitle {
  return {
    tokens: titleTokens(title),
    ents: entities(title),
    lead: leadName(title),
    desc: description ? titleTokens(description.slice(0, 400)) : new Set(),
    action: actionOf(title),
  };
}

// Headlines of one or two key words ("Chile", "Mexico" on a travel-advice
// feed, "Lufthansa strike") say too little: two such items are the same
// story only if their teasers also describe the same thing.
export const SHORT_TITLE_TOKENS = 2;

export function sameStoryPrepared(x: PreparedTitle, y: PreparedTitle): boolean {
  if (entityConflict(x.ents, y.ents)) return false;
  const xa = x.action, ya = y.action;
  if (xa && ya && ((xa.stop && !xa.start && ya.start && !ya.stop) || (xa.start && !xa.stop && ya.stop && !ya.start))) return false;
  const { jaccard, overlap, shared } = similarity(x.tokens, y.tokens);
  if (Math.min(x.tokens.size, y.tokens.size) <= SHORT_TITLE_TOKENS) {
    if (shared === 0 || !x.desc?.size || !y.desc?.size) return false;
    const d = similarity(x.desc, y.desc);
    return d.jaccard >= 0.5 || (d.shared >= 4 && d.overlap >= 0.6);
  }
  const min = Math.min(x.tokens.size, y.tokens.size);
  let sharedPlace = false; // a named place or brand both headlines mention
  for (const e of x.ents) if (y.ents.has(e)) sharedPlace = true;
  // Two headlines led by different names ("Air Canada cancels…" / "WestJet
  // cancels…") are different companies' news unless they also share a place.
  if (x.lead && y.lead && x.lead !== y.lead && !x.tokens.has(y.lead) && !y.tokens.has(x.lead) && !sharedPlace) return false;
  // A short headline whose few words all appear in a long one is not enough
  // on its own: the long one must not be mostly about something else.
  if (jaccard >= 0.5 || (shared >= 3 && overlap >= 0.66 && jaccard >= 0.35) || (shared >= 2 && overlap >= 0.66 && min <= 4 && jaccard >= 0.35)) return true;
  // Differently worded headlines about one event: both name the same place
  // or brand and share at least four key words (e.g. "Belgrade increases
  // visitor fee ... October 15" / "Belgrade introduces new tourist tax: From
  // October 15th"), or the same place and three key words ("Airlines suspend
  // flights to Riyadh after attack" / "Air India cancels Riyadh flights
  // after attack on airport").
  const sharedEntity = sharedPlace || (!!x.lead && x.lead === y.lead);
  if (sharedEntity && shared >= 4 && overlap >= 0.5) return true;
  if (!(sharedPlace && shared >= 3 && overlap >= 0.4)) return false;
  // For the looser place rule, at least two shared words must say what
  // happened ("flights", "attack"), not just that something changed for
  // visitors.
  let telling = 0;
  for (const t of x.tokens) if (y.tokens.has(t) && !WEAK_WORDS.has(t) && !(x.ents.has(t) && y.ents.has(t))) telling++;
  return telling >= 2;
}

export function sameStoryTitles(titleA: string, titleB: string, descA = "", descB = ""): boolean {
  return sameStoryPrepared(prepareTitle(titleA, descA), prepareTitle(titleB, descB));
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
