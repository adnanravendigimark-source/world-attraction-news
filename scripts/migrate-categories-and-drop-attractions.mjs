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
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log("Migrating categories table...");
  await sql`
    ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS image TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS image_alt TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS meta_title TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT ''
  `;
  console.log("Categories table columns added.");

  console.log("Dropping attractions table if exists...");
  await sql`DROP TABLE IF EXISTS attractions CASCADE`;
  console.log("Attractions table dropped.");
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
