// One-off, re-runnable: the site's coverage categories (Oct 2026 redesign).
//
//   node scripts/categories-2026-10.mjs
//
// 1. Adds the seven categories the public design uses, if missing. Existing
//    rows are left alone, so later edits in Admin -> Categories survive a
//    re-run.
// 2. Gives published articles that have no category a sensible one (only
//    where category_id is empty, never overriding an editor's choice).
// 3. Moves articles off the old "sagrada-familia" category to Attractions,
//    then deletes that category. Its old URL redirects to
//    /categories/attractions (next.config.mjs).

import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

const CATEGORIES = [
  { slug: "aviation", name: "Aviation", description: "Latest airline news, flight updates, route launches and industry developments.", image: "/images/trending/trending-visa.jpg", imageAlt: "Commercial airliner in flight at sunset" },
  { slug: "airports", name: "Airports", description: "Updates from major international and regional airports worldwide.", image: "/images/categories/airports.jpg", imageAlt: "Airport control tower overlooking the runway at sunset" },
  { slug: "travel-rules", name: "Travel Rules", description: "Visa updates, entry requirements and travel regulations.", image: "/images/news/passport-visa.jpg", imageAlt: "Passport and visa stamps on a travel map" },
  { slug: "destinations", name: "Destinations", description: "News and updates from the world's top travel destinations.", image: "/images/categories/destinations.jpg", imageAlt: "Tropical lagoon with longtail boats and limestone cliffs" },
  { slug: "attractions", name: "Attractions", description: "Latest news from famous attractions, landmarks and tourist sites.", image: "/images/destinations/rome.jpg", imageAlt: "The Colosseum in Rome at sunset" },
  { slug: "travel-tips", name: "Travel Tips", description: "Helpful travel advice, guides and expert tips for a better trip.", image: "/images/destinations/paris.jpg", imageAlt: "The Eiffel Tower in Paris at dusk" },
  { slug: "cruises", name: "Cruises", description: "Cruise lines, new ships, itineraries and river cruises.", image: "", imageAlt: "" },
];

// Published articles that had no category when this was written.
const ASSIGN = {
  "missile-strikes-disrupt-flights-riyadhs-king-khalid-airport": "airports",
  "thailand-indonesia-vietnam-tighten-visa-rules-tourists": "travel-rules",
  "siam-park-itinerary": "attractions",
  "arno-boat-tour": "attractions",
  "comprehensive-guide-to-must-see-attractions-in-italy": "destinations",
};

async function main() {
  for (const [i, c] of CATEGORIES.entries()) {
    const rows = await sql`
      INSERT INTO categories (slug, name, description, image, image_alt, sort_order)
      VALUES (${c.slug}, ${c.name}, ${c.description}, ${c.image}, ${c.imageAlt}, ${i})
      ON CONFLICT (slug) DO NOTHING
      RETURNING slug`;
    console.log(rows.length ? `added ${c.slug}` : `exists ${c.slug}`);
  }

  for (const [slug, cat] of Object.entries(ASSIGN)) {
    const rows = await sql`
      UPDATE articles SET category_id = (SELECT id FROM categories WHERE slug = ${cat})
      WHERE slug = ${slug} AND category_id IS NULL
      RETURNING slug`;
    if (rows.length) console.log(`${slug} -> ${cat}`);
  }

  const moved = await sql`
    UPDATE articles SET category_id = (SELECT id FROM categories WHERE slug = 'attractions')
    WHERE category_id = (SELECT id FROM categories WHERE slug = 'sagrada-familia')
    RETURNING slug`;
  for (const r of moved) console.log(`${r.slug} -> attractions (from sagrada-familia)`);

  // Any other table pointing at it uses ON DELETE SET NULL.
  const removed = await sql`DELETE FROM categories WHERE slug = 'sagrada-familia' RETURNING slug`;
  if (removed.length) console.log("deleted category sagrada-familia");

  // Header "Top categories" setting: drop the deleted slug if it was picked.
  await sql`
    UPDATE settings SET featured_category_slugs = array_to_string(array_remove(string_to_array(featured_category_slugs, ','), 'sagrada-familia'), ',')
    WHERE id = 1 AND featured_category_slugs LIKE '%sagrada-familia%'`;

  const all = await sql`SELECT slug FROM categories ORDER BY sort_order, name`;
  console.log("categories now:", all.map((r) => r.slug).join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
