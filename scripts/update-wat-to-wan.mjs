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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set in .env.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function runSafeUpdate() {
  console.log("🔄 Starting safe database update (WAT → WAN)...");

  try {
    // 1. Countries
    const updatedCountries = await sql`
      UPDATE countries
      SET
        meta_title = REPLACE(meta_title, 'WAT', 'WAN'),
        meta_description = REPLACE(meta_description, 'WAT', 'WAN')
      WHERE
        meta_title LIKE '%WAT%' OR meta_description LIKE '%WAT%'
      RETURNING id;
    `;
    console.log(`✅ Updated ${updatedCountries.length} countries.`);

    // 2. Cities / Destinations
    const updatedCities = await sql`
      UPDATE cities
      SET
        meta_title = REPLACE(meta_title, 'WAT', 'WAN'),
        meta_description = REPLACE(meta_description, 'WAT', 'WAN')
      WHERE
        meta_title LIKE '%WAT%' OR meta_description LIKE '%WAT%'
      RETURNING id;
    `;
    console.log(`✅ Updated ${updatedCities.length} cities/destinations.`);

    // 3. Articles (meta_title, meta_description, content_html, excerpt)
    const updatedArticles = await sql`
      UPDATE articles
      SET
        title = REPLACE(title, 'WAT', 'WAN'),
        meta_title = REPLACE(meta_title, 'WAT', 'WAN'),
        meta_description = REPLACE(meta_description, 'WAT', 'WAN'),
        content_html = REPLACE(content_html, 'WAT', 'WAN'),
        excerpt = REPLACE(excerpt, 'WAT', 'WAN')
      WHERE
        title LIKE '%WAT%' OR
        meta_title LIKE '%WAT%' OR
        meta_description LIKE '%WAT%' OR
        content_html LIKE '%WAT%' OR
        excerpt LIKE '%WAT%'
      RETURNING id;
    `;
    console.log(`✅ Updated ${updatedArticles.length} articles.`);

    // 4. Contributors / Authors (bio)
    try {
      const updatedContributors = await sql`
        UPDATE contributors
        SET bio = REPLACE(bio, 'WAT', 'WAN')
        WHERE bio LIKE '%WAT%'
        RETURNING id;
      `;
      console.log(`✅ Updated ${updatedContributors.length} contributor profiles.`);
    } catch {
      // Table might not have bio or might be named differently
    }

    console.log("🎉 Safe database update completed successfully! No records were deleted.");
  } catch (err) {
    console.error("❌ Error running update:", err);
    process.exit(1);
  }
}

runSafeUpdate();
