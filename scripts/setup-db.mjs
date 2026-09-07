// One-time (and safe-to-re-run) database setup.
//
// What it does:
//   1. Creates every table the app needs, if they don't already exist.
//   2. If the cities/categories/users/articles tables are empty, seeds them
//      with 5 launch cities, 5 categories, one approved "launch editor"
//      contributor per city, and 2 illustrative sample articles per city —
//      so the public site isn't empty on day one. These seed articles are
//      general, evergreen visitor-info pieces (not fabricated breaking
//      news with invented dates/statistics) — swap them for real
//      contributor-submitted reporting once real users are approved. See
//      README.md.
//
// How to run it:
//   1. Add DATABASE_URL to your .env — get it from a Neon project dashboard
//      (https://neon.tech) → Connection Details → "Pooled connection".
//   2. Add BLOB_READ_WRITE_TOKEN too (Vercel dashboard → Storage → Blob →
//      create a store → Connect to Project, or `vercel blob store add`).
//   3. Add the same values to your Vercel project's Settings → Environment
//      Variables for Production/Preview/Development.
//   4. From the project root: npm install && node scripts/setup-db.mjs
//   5. Redeploy.
//
// Safe to run again later — only creates tables that don't exist and only
// seeds a table if it's currently empty, so it never overwrites content
// edited through the live app.

import fs from "fs";
import path from "path";
import crypto from "crypto";
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
  console.error("DATABASE_URL is not set. Add it to your .env file, then re-run.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function createTables() {
  console.log("Creating tables (if they don't already exist)...");

  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  await sql`
    CREATE TABLE IF NOT EXISTS countries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE,
      intro TEXT NOT NULL DEFAULT '',
      hero_image TEXT NOT NULL DEFAULT '',
      hero_image_alt TEXT NOT NULL DEFAULT '',
      meta_title TEXT NOT NULL DEFAULT '',
      meta_description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      country_slug TEXT NOT NULL DEFAULT '',
      hero_image TEXT NOT NULL DEFAULT '',
      hero_image_alt TEXT NOT NULL DEFAULT '',
      intro TEXT NOT NULL DEFAULT '',
      meta_title TEXT NOT NULL DEFAULT '',
      meta_description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'contributor',
      status TEXT NOT NULL DEFAULT 'pending',
      display_name TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
      auth_provider TEXT NOT NULL DEFAULT 'password',
      google_id TEXT UNIQUE,
      avatar_url TEXT NOT NULL DEFAULT '',
      reset_token TEXT,
      reset_token_expires TIMESTAMPTZ,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      email_verify_token TEXT,
      email_verify_token_expires TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      approved_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS articles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL DEFAULT '',
      content_html TEXT NOT NULL DEFAULT '',
      city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
      category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'draft',
      score NUMERIC,
      admin_feedback TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      image_alt TEXT NOT NULL DEFAULT '',
      meta_title TEXT NOT NULL DEFAULT '',
      meta_description TEXT NOT NULL DEFAULT '',
      focus_keyword TEXT NOT NULL DEFAULT '',
      tags TEXT[] NOT NULL DEFAULT '{}',
      canonical_url TEXT NOT NULL DEFAULT '',
      word_count INTEGER NOT NULL DEFAULT 0,
      reading_time_minutes INTEGER NOT NULL DEFAULT 0,
      originality_score NUMERIC,
      originality_flag BOOLEAN NOT NULL DEFAULT false,
      submitted_at TIMESTAMPTZ,
      reviewed_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS articles_city_status_idx ON articles (city_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS articles_author_idx ON articles (author_id)`;
  await sql`CREATE INDEX IF NOT EXISTS articles_status_idx ON articles (status)`;

  // Phase 2 (Admin Panel) additions.
  await sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      admin_id TEXT NOT NULL DEFAULT '',
      admin_email TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT '',
      target_id TEXT NOT NULL DEFAULT '',
      target_label TEXT NOT NULL DEFAULT '',
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log (created_at DESC)`;

  // Single-row site settings (id is always 1) — sitewide SEO fallbacks and
  // public-content defaults managed from /admin/seo and /admin/settings.
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      homepage_intro_override TEXT NOT NULL DEFAULT '',
      default_meta_description TEXT NOT NULL DEFAULT '',
      default_og_image TEXT NOT NULL DEFAULT '',
      robots_default TEXT NOT NULL DEFAULT 'index',
      featured_city_slugs TEXT NOT NULL DEFAULT '',
      moderation_note TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT settings_single_row CHECK (id = 1)
    )
  `;
  await sql`INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;

  // Phase 3 (public website) additions — real persistence for the /contact
  // form and the homepage/footer newsletter signup, so neither is a fake
  // form that silently discards what a reader submits.
  await sql`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  console.log("Tables ready.");
}

// Phase 2 (Admin Panel) additions on top of a database set up before these
// existed. Additive and safe to re-run.
async function addPhase2Columns() {
  console.log("Ensuring Phase 2 (admin panel) columns exist...");
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`;
  await sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS canonical_url TEXT NOT NULL DEFAULT ''`;
  await sql`INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
  console.log("Phase 2 columns ready.");
}

// Phase 1 (user system) additions on top of a database that was already
// set up before Google login, password reset, drafts, or the originality
// check existed. Every statement here is additive and safe to re-run —
// ADD COLUMN IF NOT EXISTS is a no-op once the column exists, and the two
// ALTER COLUMN ... DROP NOT NULL calls are idempotent (dropping a
// constraint that's already gone is a no-op in Postgres).
async function addPhase1Columns() {
  console.log("Ensuring Phase 1 (user system) columns exist...");

  // Google-only accounts have no password — relax the old NOT NULL.
  await sql`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`;
  // Unique index instead of a UNIQUE column constraint so NULL (every
  // password-only account) never collides — Postgres already treats
  // multiple NULLs as distinct under a unique index, but being explicit
  // here avoids relying on that if this ever runs against an older PG.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key ON users (google_id) WHERE google_id IS NOT NULL`;

  // Drafts aren't "submitted" yet — allow a null submitted_at.
  await sql`ALTER TABLE articles ALTER COLUMN submitted_at DROP NOT NULL`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS word_count INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS originality_score NUMERIC`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS originality_flag BOOLEAN NOT NULL DEFAULT false`;

  console.log("Phase 1 columns ready.");
}

// Phase 4 ("Final Phase" — production-readiness pass): attraction-level
// content structure, revision history, a proper review audit trail,
// notifications, scheduled publishing, editorial flags, view counts,
// moderation signals, author pages, and analytics-ready settings. Every
// statement is additive (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT
// EXISTS) and safe to re-run against a database already carrying Phase 1-3
// data — nothing here drops or renames an existing column, and the
// existing status values ('draft', 'pending', 'approved', 'rejected',
// 'published') keep meaning exactly what they meant before. New status
// values ('under_review', 'changes_requested', 'scheduled', 'unpublished')
// are additive states the app now also understands; `status` stays a plain
// TEXT column (no CHECK constraint), consistent with how it was already
// modeled, with the state machine enforced in the application layer
// (lib/articles.ts).
async function createPhase4Tables() {
  console.log("Creating Phase 4 (production-readiness) tables...");

  // City -> Attraction -> Article. An attraction always belongs to exactly
  // one city; its slug only needs to be unique within that city (so
  // "old-town" could exist under two different cities), mirroring how
  // article slugs are unique site-wide but attraction slugs are scoped.
  await sql`
    CREATE TABLE IF NOT EXISTS attractions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      hero_image TEXT NOT NULL DEFAULT '',
      hero_image_alt TEXT NOT NULL DEFAULT '',
      meta_title TEXT NOT NULL DEFAULT '',
      meta_description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (city_id, slug)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS attractions_city_idx ON attractions (city_id)`;

  // Full version history of an article's content. A new row is inserted
  // every time content is meaningfully saved (draft autosave excluded —
  // see lib/revisions.ts — otherwise every keystroke's autosave would
  // flood this table; a revision is snapshotted on submit, on every admin
  // edit, and whenever an admin restores an older version). Never
  // overwritten or deleted by normal app flow, so "never permanently
  // overwrite article history" holds even though the live `articles` row
  // itself is mutable.
  await sql`
    CREATE TABLE IF NOT EXISTS article_revisions (
      id SERIAL PRIMARY KEY,
      article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      editor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      editor_email TEXT NOT NULL DEFAULT '',
      editor_role TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      excerpt TEXT NOT NULL DEFAULT '',
      content_html TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      image_alt TEXT NOT NULL DEFAULT '',
      change_summary TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS article_revisions_article_idx ON article_revisions (article_id, created_at DESC)`;

  // Append-only review decision log. articles.score / articles.admin_feedback
  // (added in Phase 1/2) remain the "current" cached values shown
  // everywhere for backward compatibility — this table is the full history
  // of every review decision ever made on an article (who, when, what
  // decision, what score, what moderation signals were showing at the
  // time), which the single mutable columns on `articles` can't represent
  // on their own.
  await sql`
    CREATE TABLE IF NOT EXISTS article_reviews (
      id SERIAL PRIMARY KEY,
      article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
      admin_email TEXT NOT NULL DEFAULT '',
      decision TEXT NOT NULL,
      score NUMERIC,
      feedback TEXT NOT NULL DEFAULT '',
      moderation_signals JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS article_reviews_article_idx ON article_reviews (article_id, created_at DESC)`;

  // In-app + (best-effort) emailed notifications for both contributors and
  // admins. `read_at` powers the unread badge in the dashboard notification
  // center; `email_sent` records whether lib/email.ts actually reached a
  // configured provider for this one (see lib/email.ts — without
  // RESEND_API_KEY it logs instead of sending, and this column reflects
  // that honestly rather than always claiming true).
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      read_at TIMESTAMPTZ,
      email_sent BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, read_at, created_at DESC)`;

  console.log("Phase 4 tables ready.");
}

async function addPhase4Columns() {
  console.log("Ensuring Phase 4 (production-readiness) columns exist...");

  // Attraction-level content structure — optional on every article (a
  // contributor can still write a city-level piece with no specific
  // attraction), scoped to the article's own city at the application layer.
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS attraction_id UUID REFERENCES attractions(id) ON DELETE SET NULL`;
  await sql`CREATE INDEX IF NOT EXISTS articles_attraction_idx ON articles (attraction_id)`;

  // Editorial placement controls — real booleans an admin toggles from the
  // Article Review page; homepage sections read these directly rather than
  // guessing at "trending" from nothing.
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS trending BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS editors_pick BOOLEAN NOT NULL DEFAULT false`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS breaking BOOLEAN NOT NULL DEFAULT false`;

  // Scheduled publishing — a future timestamp checked by
  // lib/scheduling.ts's publishDueScheduledArticles(), which is called from
  // both a dedicated cron API route and every public content read, so a
  // scheduled article goes live automatically at (or shortly after) the
  // right time with no manual "Publish" click required.
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`;

  // Real page-view counter — incremented exactly once per real public
  // article page render (see lib/articles.ts incrementArticleView), never
  // seeded or faked. This is the honest foundation "Popular articles" /
  // analytics requirements ask for, not a placeholder number.
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0`;

  // Cached moderation-signal snapshot from the most recent submission —
  // duplicate/similarity, basic spam heuristics, quality checks, and an
  // AI-generated-content heuristic (see lib/moderation.ts). Always
  // review-only signals for the admin, never used to auto-reject.
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS moderation_signals JSONB`;

  // Author pages (/author/[slug]) need a stable, unique, URL-safe handle
  // per user. Backfilled for existing accounts below; generated for every
  // new account going forward in lib/users.ts.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_slug_key ON users (slug) WHERE slug IS NOT NULL`;

  // Analytics-ready settings — Google Analytics / Search Console are
  // structurally wired (env-driven script injection + verification meta
  // tag) but stay inert with no real numbers shown anywhere until an admin
  // supplies real IDs here; see README.md.
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS ga_measurement_id TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS gsc_verification_code TEXT NOT NULL DEFAULT ''`;

  // Basic admin management for newsletter subscribers (unsubscribe) and
  // contact messages (mark handled) — see /admin/newsletter and the
  // contact_messages read in /admin/settings.
  await sql`ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ`;

  console.log("Phase 4 columns ready.");
}

// Real, database-backed rate limiting for auth endpoints (login,
// admin-login, signup, forgot-password) — see lib/rateLimit.ts. Using
// Postgres instead of in-memory state means the limit holds even across
// multiple serverless function instances, not just within one warm
// process.
async function createPhase5SecurityTables() {
  console.log("Creating Phase 5 (security) tables...");
  await sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      window_start TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  console.log("Phase 5 tables ready.");
}

// The Calendar/Events feature (public /calendar page, Admin -> Events) was
// removed entirely. This drops the table it used to own so a database that
// ran the old Phase 6 migration doesn't keep an orphaned, unreferenced
// table around forever. Idempotent — a fresh database that never had this
// table just no-ops here.
async function dropEventsTable() {
  const exists = await sql`SELECT to_regclass('public.events') AS reg`;
  if (!exists[0]?.reg) return;
  console.log("Removing retired 'events' table (Calendar feature removed)...");
  await sql`DROP TABLE IF EXISTS events`;
  console.log("'events' table removed.");
}

// Email verification for password signups — a new contributor account
// isn't shown to admins for approval until the person has clicked the
// link in their verification email (Google signups skip this: Google
// already verified the email before this app ever creates the account).
//
// Safe to run against a database that already has real users in it: the
// column is added with DEFAULT true first (so every existing account —
// which never had a "verify your email" step in the first place — reads
// as already verified and isn't retroactively locked out), and only then
// is the column default flipped to false so every NEW row from this point
// forward starts unverified until the real registerContributor()/
// findOrCreateGoogleUser() INSERTs explicitly set it.
async function createPhase7EmailVerificationColumns() {
  console.log("Ensuring Phase 7 (email verification) columns exist...");
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true`;
  await sql`ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token_expires TIMESTAMPTZ`;
  console.log("Phase 7 columns ready.");
}

// Phase 8: lets the .env ADMIN_EMAIL/ADMIN_PASSWORD "owner" account change
// its own password from the Admin Panel (Settings) instead of only via
// environment variables + redeploy. Empty string means "no override set
// yet" — the owner login keeps falling back to ADMIN_PASSWORD from .env
// until they set one here. See lib/settings.ts and
// app/api/admin/profile/password/route.ts.
async function createPhase8OwnerPasswordColumn() {
  console.log("Ensuring Phase 8 (owner password override) column exists...");
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS owner_password_hash TEXT NOT NULL DEFAULT ''`;
  console.log("Phase 8 column ready.");
}

// Phase 9: makes every part of the public footer admin-editable (About text,
// social links, the link columns, and the copyright line) instead of it
// being hardcoded in components/PublicFooter.tsx. NULL means "no override
// saved yet" — lib/settings.ts's getFooterConfig() falls back to the same
// defaults the footer used to have hardcoded, so an un-migrated or
// freshly-created site still renders a complete footer. See Admin ->
// Footer (components/admin/FooterManager.tsx).
async function createPhase9FooterConfigColumn() {
  console.log("Ensuring Phase 9 (footer config) column exists...");
  await sql`ALTER TABLE settings ADD COLUMN IF NOT EXISTS footer_config JSONB`;
  console.log("Phase 9 column ready.");
}

// Same slugify rule as lib/countries.ts's slugifyCountry() — duplicated
// here in plain JS since this script isn't compiled through TypeScript and
// can't import a .ts module. Keep the two in sync if either changes.
function slugifyCountryName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Backs the /destinations/[countrySlug]/[citySlug] URL restructure — every
// city needs a stable, URL-safe country segment derived from its (now
// autocomplete-selected, canonical) country name. Idempotent: only backfills
// rows where country_slug is still empty, so re-running never overwrites a
// slug that's already set (including one an admin might theoretically have
// hand-edited via a future admin tool).
async function addCountrySlugColumn() {
  console.log("Ensuring cities.country_slug column exists...");
  await sql`ALTER TABLE cities ADD COLUMN IF NOT EXISTS country_slug TEXT NOT NULL DEFAULT ''`;
  const rows = await sql`SELECT id, country FROM cities WHERE country_slug = ''`;
  if (rows.length) {
    console.log(`Backfilling country_slug for ${rows.length} city row(s)...`);
    for (const row of rows) {
      await sql`UPDATE cities SET country_slug = ${slugifyCountryName(row.country)} WHERE id = ${row.id}`;
    }
  }
  await sql`CREATE INDEX IF NOT EXISTS cities_country_slug_idx ON cities (country_slug)`;
  console.log("cities.country_slug ready.");
}

// Every user row needs a unique slug for /author/[slug] — including
// accounts created before this column existed. Idempotent: only touches
// rows where slug IS NULL, so re-running never reshuffles an existing
// author's URL.
async function backfillUserSlugs() {
  const rows = await sql`SELECT id, display_name, email FROM users WHERE slug IS NULL`;
  if (!rows.length) return;
  console.log(`Backfilling author slugs for ${rows.length} user(s)...`);
  const taken = new Set(
    (await sql`SELECT slug FROM users WHERE slug IS NOT NULL`).map((r) => r.slug)
  );
  for (const row of rows) {
    const base =
      (row.display_name || row.email.split("@")[0])
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60) || "contributor";
    let slug = base;
    let i = 2;
    while (taken.has(slug)) {
      slug = `${base}-${i}`;
      i++;
    }
    taken.add(slug);
    await sql`UPDATE users SET slug = ${slug} WHERE id = ${row.id}`;
  }
  console.log("Author slugs backfilled.");
}

const CITY_SEED = [
  {
    slug: "barcelona",
    name: "Barcelona",
    country: "Spain",
    heroImage: "https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=2000&auto=format&fit=crop",
    heroImageAlt: "Park Güell mosaic terrace overlooking Barcelona, Spain",
    intro:
      "News and visitor updates from Barcelona's landmark attractions, museums, and parks — from Gaudí's Sagrada Família and Park Güell to the Gothic Quarter and Camp Nou.",
    metaTitle: "Barcelona Attraction News & Visitor Updates",
    metaDescription:
      "The latest news, ticket updates, and visitor guides for Barcelona's attractions — Sagrada Família, Park Güell, and more.",
  },
  {
    slug: "amsterdam",
    name: "Amsterdam",
    country: "Netherlands",
    heroImage: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?q=80&w=2000&auto=format&fit=crop",
    heroImageAlt: "Canal houses along an Amsterdam canal, Netherlands",
    intro:
      "News and visitor updates from Amsterdam's museums and canal-side attractions — the Anne Frank House, Van Gogh Museum, Rijksmuseum, and the historic canal ring.",
    metaTitle: "Amsterdam Attraction News & Visitor Updates",
    metaDescription:
      "The latest news, ticket updates, and visitor guides for Amsterdam's museums and attractions — Anne Frank House, Van Gogh Museum, and more.",
  },
  {
    slug: "paris",
    name: "Paris",
    country: "France",
    heroImage: "https://images.unsplash.com/photo-1502602898536-47ad22581b52?q=80&w=2000&auto=format&fit=crop",
    heroImageAlt: "The Eiffel Tower seen from the Trocadéro gardens, Paris, France",
    intro:
      "News and visitor updates from Paris's landmark attractions — the Eiffel Tower, the Louvre, Notre-Dame, and the museums and monuments across the city.",
    metaTitle: "Paris Attraction News & Visitor Updates",
    metaDescription:
      "The latest news, ticket updates, and visitor guides for Paris's landmark attractions — Eiffel Tower, Louvre, Notre-Dame, and more.",
  },
  {
    slug: "rome",
    name: "Rome",
    country: "Italy",
    heroImage: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=2000&auto=format&fit=crop",
    heroImageAlt: "The Colosseum in Rome, Italy, seen in daylight",
    intro:
      "News and visitor updates from Rome's ancient sites and museums — the Colosseum, the Roman Forum, Vatican Museums, and the Sistine Chapel.",
    metaTitle: "Rome Attraction News & Visitor Updates",
    metaDescription:
      "The latest news, ticket updates, and visitor guides for Rome's attractions — Colosseum, Vatican Museums, and more.",
  },
  {
    slug: "london",
    name: "London",
    country: "United Kingdom",
    heroImage: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=2000&auto=format&fit=crop",
    heroImageAlt: "The London Eye and South Bank on the River Thames, London, UK",
    intro:
      "News and visitor updates from London's landmark attractions — the Tower of London, the British Museum, the London Eye, and the city's royal palaces.",
    metaTitle: "London Attraction News & Visitor Updates",
    metaDescription:
      "The latest news, ticket updates, and visitor guides for London's attractions — Tower of London, British Museum, London Eye, and more.",
  },
];

const CATEGORY_SEED = [
  { slug: "new-attractions", name: "New Attractions", sortOrder: 0 },
  { slug: "tickets-and-pricing", name: "Tickets & Pricing", sortOrder: 1 },
  { slug: "openings-and-closures", name: "Openings & Closures", sortOrder: 2 },
  { slug: "events-and-festivals", name: "Events & Festivals", sortOrder: 3 },
  { slug: "visitor-tips", name: "Visitor Tips", sortOrder: 4 },
];

// Two general, evergreen visitor-info articles per city — deliberately
// written as safe, broadly-true practical guidance rather than invented
// "breaking news" with fabricated dates or statistics, since nobody has
// actually reported these yet. Attributed to a per-city "Launch Editorial
// Team" seed account. Replace with real contributor reporting once real
// users are approved — see README.md.
const ARTICLE_SEED = {
  barcelona: [
    {
      title: "Visiting Sagrada Família: What First-Time Visitors Should Know",
      category: "visitor-tips",
      excerpt:
        "Gaudí's unfinished basilica remains one of the most visited sights in Spain — here's how to plan a smoother visit.",
      image: "https://images.unsplash.com/photo-1583779457094-ab6f77f7bf1a?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "Interior of Sagrada Família basilica showing its stained-glass columns, Barcelona",
      html: `<p>The Sagrada Família is Barcelona's most-visited paid attraction and one of the most recognizable buildings in the world, drawing millions of visitors a year to see Antoni Gaudí's still-unfinished basilica.</p><h2>Book timed-entry tickets in advance</h2><p>Sagrada Família uses timed-entry ticketing, and entry slots — especially in summer — can sell out days or weeks ahead. Booking directly through the basilica's official ticketing channel is the most reliable way to secure a specific time and avoid the walk-up queue.</p><h2>Tower access is a separate, limited-capacity ticket</h2><p>Access to the Nativity or Passion towers is sold as an upgrade with its own limited capacity and involves a narrow spiral staircase on the way down — it is not included in standard admission and is worth booking early if it matters to your visit.</p><h2>Go early or late for softer light</h2><p>The basilica's stained-glass windows are famous for flooding the interior with color; the effect is strongest in direct morning or late-afternoon sun, so an early or end-of-day visit tends to be more dramatic than midday.</p>`,
    },
    {
      title: "Park Güell: Free Zone vs. the Monumental Core, Explained",
      category: "tickets-and-pricing",
      excerpt:
        "Not all of Park Güell requires a ticket — here's the difference between the free public park and the paid Monumental Zone.",
      image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "Mosaic-tiled bench on the terrace of Park Güell, Barcelona",
      html: `<p>Park Güell is often described as one attraction, but it is really two: a large public park that is free to enter, and a smaller, ticketed "Monumental Zone" that contains most of Gaudí's best-known mosaic work, including the dragon fountain and the tiled serpentine bench.</p><h2>What's free</h2><p>The wooded paths, viewpoints over the city, and outer gardens of Park Güell are open to the public at no charge, with no ticket required.</p><h2>What requires a ticket</h2><p>The Monumental Zone — the colorful mosaic terrace, the Hypostyle Room with its forest of columns, and Gaudí's house-museum — is ticketed with timed entry, and capacity is limited per slot.</p><h2>Getting there</h2><p>Park Güell sits on a hill above the city center; most visitors arrive by metro to Lesseps or Vallcarca and walk up, or take a bus route that stops closer to the entrance.</p>`,
    },
    {
      title: "Sagrada Família's Construction: Why the Basilica Still Isn't Finished",
      category: "new-attractions",
      excerpt:
        "Gaudí's basilica has been under construction since 1882 — here's why, and what completion actually depends on.",
      image: "https://images.unsplash.com/photo-1583779457094-ab6f77f7bf1a?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "Interior of Sagrada Família basilica showing its stained-glass columns, Barcelona",
      html: `<p>Sagrada Família has been under continuous construction since ground was broken in 1882, making it one of the longest-running building projects still active anywhere in the world — and it remains an evolving building rather than a finished monument.</p><h2>Why it's taken so long</h2><p>The basilica was never publicly funded; construction has always been paid for through ticket sales and donations, which is part of why progress historically moved slowly compared with government-backed projects, especially during long funding gaps in the 20th century.</p><h2>What's still being built</h2><p>The central towers, including the tallest tower representing Jesus Christ, are among the last major elements still under construction, along with ongoing decorative work on the façades.</p><h2>What this means for visitors</h2><p>Because it's an active construction site, scaffolding and cranes are a normal part of the exterior view on any given visit, and specific areas can occasionally be closed off for work — it's worth checking the basilica's official site for any notices before you go.</p>`,
    },
    {
      title: "La Mercè: Barcelona's Biggest Annual Street Festival, Explained",
      category: "events-and-festivals",
      excerpt:
        "Barcelona's patron saint festival takes over the city each autumn with free, citywide events — here's what actually happens.",
      image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "Mosaic-tiled bench on the terrace of Park Güell, Barcelona",
      html: `<p>La Mercè is Barcelona's largest annual festival, held each year in late September in honor of the city's patron saint, and it fills the city center with free public events for several days.</p><h2>What to expect</h2><p>Signature elements include correfoc ("fire run") processions with costumed devils and fireworks, human towers (castells) built by local teams competing in the city's main square, and a giants' parade featuring oversized painted figures that have been part of Catalan festival tradition for generations.</p><h2>It's free and citywide</h2><p>Unlike a ticketed festival, most La Mercè events are free and spread across multiple neighborhoods and squares, with a published schedule released closer to the date each year.</p><h2>Plan around the crowds</h2><p>Central areas like Plaça de Sant Jaume and Plaça Espanya get very busy during headline events, so arriving early for a good vantage point — or watching from a slightly less central location — makes for a more comfortable experience.</p>`,
    },
  ],
  amsterdam: [
    {
      title: "Anne Frank House: Why Advance Booking Is Essential",
      category: "tickets-and-pricing",
      excerpt: "This is one of the hardest tickets in Amsterdam to get on short notice — here's how the system works.",
      image: "https://images.unsplash.com/photo-1600361214023-38a0e8d5a4f5?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "Canal houses in central Amsterdam near the Anne Frank House museum",
      html: `<p>The Anne Frank House is consistently one of the most-requested museum tickets in Amsterdam, and unlike many attractions, it releases tickets on a strict advance schedule rather than allowing significant walk-up entry.</p><h2>Tickets release weeks ahead</h2><p>The museum sells timed-entry tickets online starting roughly six weeks before the visit date, and popular dates and times can sell out within minutes of release.</p><h2>A small same-day allotment exists</h2><p>A limited number of same-day tickets are released online each morning, but demand for these is high and they are not a reliable way to plan a visit around.</p><h2>Plan the visit itself</h2><p>The museum recommends allowing about an hour for the visit, and the route through the building — including the hidden Secret Annex — is a fixed one-way path rather than a self-paced wander.</p>`,
    },
    {
      title: "Rijksmuseum vs. Van Gogh Museum: Which One First?",
      category: "visitor-tips",
      excerpt:
        "Amsterdam's two biggest art museums sit next to each other on Museumplein — here's how to decide which to prioritize.",
      image: "https://images.unsplash.com/photo-1541417904950-b855846fe1ab?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "Museumplein square in Amsterdam with the Rijksmuseum in the background",
      html: `<p>The Rijksmuseum and the Van Gogh Museum both sit on or near Museumplein, and both are frequently booked as a same-day pairing by visitors short on time in Amsterdam.</p><h2>The Rijksmuseum</h2><p>The Rijksmuseum is the Netherlands' national museum, spanning eight centuries of Dutch art and history, including Rembrandt's "The Night Watch" and an extensive collection of Golden Age paintings — plan at least two to three hours to see the highlights.</p><h2>The Van Gogh Museum</h2><p>The Van Gogh Museum holds the largest collection of the artist's work anywhere in the world and is organized chronologically, tracing his development as a painter — most visits run 90 minutes to two hours.</p><h2>Booking tip</h2><p>Both museums use timed-entry tickets that regularly sell out in peak season, so booking a specific slot for each in advance is worth doing rather than assuming same-day entry.</p>`,
    },
    {
      title: "Rijksstudio: How the Rijksmuseum Lets You Access Its Collection Beyond the Building",
      category: "new-attractions",
      excerpt: "The Rijksmuseum's free digital platform puts high-resolution scans of its collection online — here's what it actually offers.",
      image: "https://images.unsplash.com/photo-1541417904950-b855846fe1ab?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "Museumplein square in Amsterdam with the Rijksmuseum in the background",
      html: `<p>Alongside the physical museum, the Rijksmuseum runs Rijksstudio, a free online platform offering high-resolution downloadable images of tens of thousands of works in its collection — a resource many visitors don't know exists until after their visit.</p><h2>What it's for</h2><p>Rijksstudio lets anyone browse, save, and download museum-quality scans of public-domain works for personal use, from Rembrandt and Vermeer down to lesser-known pieces that aren't always on physical display.</p><h2>Works not on the walls</h2><p>Because gallery space is limited, only a portion of the Rijksmuseum's full collection is on physical display at any time — the digital archive is the most complete way to see everything the museum holds.</p><h2>Worth a look before or after your visit</h2><p>Browsing Rijksstudio ahead of time can help prioritize which galleries to focus on in person, especially for visitors with limited time on Museumplein.</p>`,
    },
    {
      title: "Why Amsterdam Museums Sometimes Close Individual Galleries for Renovation",
      category: "openings-and-closures",
      excerpt: "A closed room on the day you visit doesn't mean bad luck — here's how rolling renovations at major museums actually work.",
      image: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "Canal houses along an Amsterdam canal, Netherlands",
      html: `<p>Large museums like the Rijksmuseum and Van Gogh Museum periodically close individual galleries or wings for conservation work, loan rotations, or refurbishment, even while the rest of the building stays fully open.</p><h2>Why this happens</h2><p>Paintings and objects need periodic conservation, temporary exhibitions require reconfiguring gallery space, and older buildings need ongoing maintenance — all of which can mean a specific room is unavailable on any given day.</p><h2>How to check before you go</h2><p>Museum websites typically list any current gallery closures or works temporarily off display on their visitor-information pages — worth a quick check shortly before your visit if there's a specific piece you're hoping to see.</p><h2>It rarely affects the whole museum</h2><p>These closures are almost always partial and localized rather than affecting general admission, so a planned visit is very unlikely to be disrupted entirely.</p>`,
    },
  ],
  paris: [
    {
      title: "Eiffel Tower: Stairs vs. Lift Tickets, and Which Levels They Reach",
      category: "tickets-and-pricing",
      excerpt: "The Eiffel Tower sells several different ticket types — here's what each one actually gets you.",
      image: "https://images.unsplash.com/photo-1502602898536-47ad22581b52?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "The Eiffel Tower viewed from below against a blue sky, Paris",
      html: `<p>The Eiffel Tower's ticketing can be confusing because access to the summit and the two lower levels are sold separately, and the option to climb by stairs is cheaper — but more limited — than taking the lift.</p><h2>Stairs tickets</h2><p>Stair access is sold only up to the second floor and does not include the summit; it is the least expensive option and typically has shorter queues than the lift line.</p><h2>Lift tickets</h2><p>Lift tickets to the second floor include both lower levels; a separate, more expensive lift ticket adds access to the summit, reached via a second lift from the second floor.</p><h2>Booking ahead matters</h2><p>Online tickets are sold in timed slots and are the most reliable way to avoid the long walk-up queues at the base of the tower, especially in summer.</p>`,
    },
    {
      title: "Louvre Museum: How to Avoid the Longest Queues",
      category: "visitor-tips",
      excerpt: "The world's most-visited museum is also one of the most crowded — a few timing choices make a real difference.",
      image: "https://images.unsplash.com/photo-1566139884906-4a3ffbdc11c9?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "The glass pyramid entrance of the Louvre Museum, Paris",
      html: `<p>The Louvre is the most-visited museum in the world, and its main pyramid entrance can see long queues at opening time, particularly on weekends and during summer.</p><h2>Book a timed ticket online</h2><p>The Louvre uses mandatory timed-entry booking, and reserving online in advance is the standard way to guarantee entry at a specific hour rather than relying on same-day availability.</p><h2>Consider a side entrance</h2><p>The Porte des Lions and the Carrousel du Louvre underground entrance are often quieter alternatives to the main pyramid entrance during busy periods.</p><h2>The Mona Lisa room is the bottleneck</h2><p>If seeing the Mona Lisa is a priority, visiting that gallery first thing after entry — before tour groups arrive later in the morning — tends to mean a shorter wait in front of the painting.</p>`,
    },
    {
      title: "The Eiffel Tower's Glass Floor: What's Actually on the First Floor Today",
      category: "new-attractions",
      excerpt: "A see-through floor panel is one of the more talked-about features on the tower's lower level — here's what's there.",
      image: "https://images.unsplash.com/photo-1502602898536-47ad22581b52?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "The Eiffel Tower viewed from below against a blue sky, Paris",
      html: `<p>The Eiffel Tower's first floor includes a glass floor section that lets visitors look straight down toward the ground below — a popular photo stop that was added as part of a broader renovation of the lower levels.</p><h2>What else is on the first floor</h2><p>Alongside the glass floor, the first floor has exhibition space covering the tower's history and construction, a small pavilion area, and views out across the surrounding gardens.</p><h2>Not for everyone</h2><p>The glass floor is optional to walk on — visitors uncomfortable with heights can bypass it via a surrounding walkway while still exploring the rest of the level.</p><h2>Combine it with a lift ticket</h2><p>The first floor is included with every ticket type, including the stairs-only option, so there's no need to upgrade just to see this feature.</p>`,
    },
    {
      title: "Bastille Day Fireworks at the Eiffel Tower: What to Know if You're in Paris on July 14",
      category: "events-and-festivals",
      excerpt: "France's national day centers on a fireworks display launched from the Eiffel Tower itself — here's how the evening unfolds.",
      image: "https://images.unsplash.com/photo-1502602898536-47ad22581b52?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "The Eiffel Tower viewed from below against a blue sky, Paris",
      html: `<p>Bastille Day, France's national holiday on July 14, is marked in Paris by a large fireworks display launched from the Eiffel Tower each year, preceded by a military parade along the Champs-Élysées earlier in the day.</p><h2>Where to watch</h2><p>The Champ de Mars, the park directly beneath the tower, is the most popular viewing spot and gets extremely crowded well before the display starts — the Trocadéro gardens across the river offer a view of the tower itself and tend to fill up just as fast.</p><h2>Arrive early</h2><p>Security checkpoints and crowd size mean that arriving several hours ahead of the display is standard practice for a good spot, and some areas may have bag restrictions in place.</p><h2>An alternative option</h2><p>Many other points along the Seine and elevated spots across the city offer a more distant but far less crowded view of the fireworks for visitors who'd rather skip the crowds directly underneath the tower.</p>`,
    },
  ],
  rome: [
    {
      title: "Colosseum, Roman Forum & Palatine Hill: One Ticket, Three Sites",
      category: "tickets-and-pricing",
      excerpt: "A standard Colosseum ticket actually covers three separate archaeological sites — here's how it works.",
      image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "The interior arches of the Colosseum, Rome",
      html: `<p>A standard Colosseum ticket is a combined ticket that also includes entry to the Roman Forum and Palatine Hill, two large archaeological areas adjacent to the amphitheater — visitors who only plan for the Colosseum itself often don't realize how much more is included.</p><h2>The ticket is valid across all three, once</h2><p>Entry to each of the three sites is normally allowed once, within a set validity window, so it is worth planning a route that covers the Forum and Palatine Hill on the same visit rather than trying to return later.</p><h2>Book the Colosseum entry time specifically</h2><p>Colosseum entry uses timed slots even though the Forum and Palatine Hill are generally more flexible about when you enter — booking the Colosseum slot in advance is the part worth prioritizing.</p><h2>Shade and water</h2><p>The Forum and Palatine Hill have very little shade across large open areas, so a visit in the middle of a hot day is significantly more demanding than the enclosed sections of the Colosseum itself.</p>`,
    },
    {
      title: "Vatican Museums & Sistine Chapel: Best Times to Avoid Crowds",
      category: "visitor-tips",
      excerpt: "The route to the Sistine Chapel runs through some of the busiest museum corridors in the world — timing helps.",
      image: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "A grand gallery hallway inside the Vatican Museums, Rome",
      html: `<p>The Vatican Museums lead visitors through a long, fixed route toward the Sistine Chapel, and because nearly every visitor is heading toward the same destination, crowd flow through the middle of the day can be dense.</p><h2>Early entry tends to be calmer</h2><p>Arriving close to opening time generally means lighter crowds in the first galleries, before large tour groups have entered the route in bulk later in the morning.</p><h2>Tickets are timed and should be booked ahead</h2><p>Vatican Museums tickets are sold for a specific entry time, and booking online in advance avoids the separate, often much longer, walk-up ticket line outside.</p><h2>The Sistine Chapel itself</h2><p>Photography is not permitted inside the Sistine Chapel, and visitors are asked to keep noise to a minimum — it is treated as a place of quiet reflection despite being one of the most crowded rooms on the route.</p>`,
    },
    {
      title: "Why Parts of the Vatican Museums Are Sometimes Closed to Visitors",
      category: "openings-and-closures",
      excerpt: "A handful of rooms along the route to the Sistine Chapel rotate in and out of access — here's why, and how to check ahead.",
      image: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "A grand gallery hallway inside the Vatican Museums, Rome",
      html: `<p>Like most major museum complexes, the Vatican Museums periodically close individual rooms or galleries along the visitor route for conservation, restoration, or preparation of temporary displays, even on days when the museums are otherwise fully open.</p><h2>Sundays and religious holidays</h2><p>The Vatican Museums are closed on Sundays (except for a free last-Sunday-of-the-month opening) and on a number of Catholic holidays each year — worth checking the official calendar before planning a specific date.</p><h2>Partial route changes</h2><p>Occasionally a specific gallery is temporarily removed from the standard route, with the path adjusted around it rather than the museums closing entirely.</p><h2>Check before booking</h2><p>The Vatican Museums' official ticketing site lists current opening days and any known closures, and is the most reliable source shortly before a visit.</p>`,
    },
    {
      title: "Natale di Roma: Rome's Annual Founding-of-the-City Festival",
      category: "events-and-festivals",
      excerpt: "Each spring, Rome marks its legendary founding date with historical reenactments across the city's ancient sites.",
      image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "The interior arches of the Colosseum, Rome",
      html: `<p>Natale di Roma ("Rome's Birthday") is an annual festival held each spring commemorating the legendary founding of the city, traditionally dated to 753 BC, with several days of events centered around the city's ancient landmarks.</p><h2>What happens</h2><p>The festival typically includes costumed historical reenactment groups depicting gladiators, legionaries, and ancient Roman civic life, along with parades and events staged near sites like the Circus Maximus and the Roman Forum.</p><h2>It's a local celebration too</h2><p>Beyond the historical reenactments, Natale di Roma is treated as a genuine civic celebration by Romans, with fireworks and public events marking the occasion each year.</p><h2>Worth checking dates in advance</h2><p>Because it's organized annually with a published schedule closer to the date, checking the city's official events calendar ahead of a spring trip is the best way to catch any of it.</p>`,
    },
  ],
  london: [
    {
      title: "Tower of London: Where to See the Crown Jewels Without the Longest Wait",
      category: "visitor-tips",
      excerpt: "The Crown Jewels are the Tower's biggest draw and its biggest bottleneck — here's how the queue tends to move.",
      image: "https://images.unsplash.com/photo-1543832923-44667a44c804?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "The White Tower at the Tower of London",
      html: `<p>The Tower of London houses the Crown Jewels in the Jewel House, which is consistently the single busiest point inside the fortress, particularly in the late morning and early afternoon.</p><h2>Head there first</h2><p>Visiting the Jewel House shortly after the Tower opens, before the site fills up for the day, generally means a shorter wait than visiting it later.</p><h2>The moving walkway keeps the line flowing</h2><p>Inside the Jewel House, a moving walkway carries visitors past the jewels themselves, which keeps the queue moving steadily even when the room is busy, rather than allowing it to stall.</p><h2>Yeoman Warder tours</h2><p>Free guided tours led by the Yeoman Warders ("Beefeaters") run at regular intervals from just inside the entrance and are a good way to get oriented before exploring the rest of the site independently.</p>`,
    },
    {
      title: "London Eye: Ticket Types and the Best Time of Day to Go",
      category: "tickets-and-pricing",
      excerpt: "Standard, fast-track, and private capsule tickets all get you the same ride — here's what actually differs.",
      image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "The London Eye observation wheel on the South Bank of the River Thames",
      html: `<p>The London Eye sells several ticket tiers that all include the same roughly 30-minute rotation, with the differences mainly coming down to queue priority and, for private capsules, exclusivity rather than the experience itself.</p><h2>Standard vs. fast-track</h2><p>Standard tickets are the least expensive option but can involve a longer wait at busy times; fast-track tickets cost more and use a separate, shorter queue.</p><h2>Best time for visibility</h2><p>Clear weather matters more than time of day for views, but late afternoon on a clear day is popular for the light over the Thames, and sunset slots are often booked well in advance.</p><h2>Combined tickets</h2><p>The London Eye is frequently sold as a combination ticket alongside other South Bank attractions such as Madame Tussauds or the Sea Life London Aquarium, which can be worth it for visitors planning to see more than one.</p>`,
    },
    {
      title: "Inside the White Tower: What's on Display in the Royal Armouries Collection",
      category: "new-attractions",
      excerpt: "The Tower of London's oldest building holds a centuries-spanning arms and armour collection — here's what's inside.",
      image: "https://images.unsplash.com/photo-1543832923-44667a44c804?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "The White Tower at the Tower of London",
      html: `<p>The White Tower, the oldest and most central building at the Tower of London, houses a Royal Armouries collection of arms and armour spanning several centuries, including suits associated with historic English monarchs.</p><h2>What's inside</h2><p>Displays include ornate ceremonial armour, weapons, and the long-running "Line of Kings" display of mounted royal figures, one of the oldest visitor attractions of its kind in the country.</p><h2>Refreshed displays</h2><p>The Royal Armouries periodically updates how the collection is presented within the White Tower, so the layout and featured pieces on a given visit can differ somewhat from an earlier trip.</p><h2>Included in general admission</h2><p>Access to the White Tower's displays is included with standard Tower of London admission — no separate ticket is needed.</p>`,
    },
    {
      title: "New Year's Eve Fireworks on the Thames: What to Know if You're Near the London Eye",
      category: "events-and-festivals",
      excerpt: "London's official New Year's Eve fireworks are launched from the London Eye and Thames-side locations — here's how it works.",
      image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1600&auto=format&fit=crop",
      imageAlt: "The London Eye observation wheel on the South Bank of the River Thames",
      html: `<p>London's official New Year's Eve fireworks display is centered on the London Eye and the surrounding stretch of the Thames, drawing large crowds to the South Bank and the opposite riverbank each year.</p><h2>Ticketed viewing areas</h2><p>Unlike most fireworks displays, London's New Year's Eve event has historically required tickets for entry into the official riverside viewing areas, with capacity limited for safety reasons.</p><h2>Free vantage points exist</h2><p>Areas further from the river, along with some elevated spots across the city, offer a free (if more distant) view of the display for visitors who don't have a ticket to the riverside zones.</p><h2>Plan transport carefully</h2><p>Road closures and heavy crowds mean walking and public transport are the practical way to get to and from the area that night — check for any transport changes in the days before.</p>`,
    },
  ],
};

async function seedCities() {
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM cities`;
  if (count > 0) {
    console.log(`cities: already has ${count} row(s) — skipping seed.`);
    return;
  }
  for (let i = 0; i < CITY_SEED.length; i++) {
    const c = CITY_SEED[i];
    await sql`
      INSERT INTO cities (slug, name, country, country_slug, hero_image, hero_image_alt, intro, meta_title, meta_description, sort_order)
      VALUES (${c.slug}, ${c.name}, ${c.country}, ${slugifyCountryName(c.country)}, ${c.heroImage}, ${c.heroImageAlt}, ${c.intro}, ${c.metaTitle}, ${c.metaDescription}, ${i})
    `;
  }
  console.log(`cities: seeded ${CITY_SEED.length} row(s).`);
}

async function seedCategories() {
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM categories`;
  if (count > 0) {
    console.log(`categories: already has ${count} row(s) — skipping seed.`);
    return;
  }
  for (const cat of CATEGORY_SEED) {
    await sql`INSERT INTO categories (slug, name, sort_order) VALUES (${cat.slug}, ${cat.name}, ${cat.sortOrder})`;
  }
  console.log(`categories: seeded ${CATEGORY_SEED.length} row(s).`);
}

async function seedLaunchEditorsAndArticles() {
  // Gated on whether launch-editor accounts already exist, NOT on whether
  // the articles table has any rows at all — the old check skipped this
  // entire seed the moment a single real article existed (e.g. a test
  // article created through the app), even on a database that never got
  // the launch content. Each INSERT below also uses
  // ON CONFLICT (slug) DO NOTHING, so this is safe to run repeatedly
  // regardless of what else is in the table.
  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM users WHERE email LIKE 'launch-editor-%@attractiontravelnews.com'
  `;
  if (count > 0) {
    console.log(`articles: launch editor accounts already exist (${count}) — launch content already seeded, skipping.`);
    return;
  }

  const cities = await sql`SELECT * FROM cities`;
  const categories = await sql`SELECT * FROM categories`;
  const cityBySlug = Object.fromEntries(cities.map((c) => [c.slug, c]));
  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

  if (!cities.length) {
    console.log("articles: no cities found — skipping article seed (run again after cities are seeded).");
    return;
  }

  let articleCount = 0;
  for (const city of cities) {
    const items = ARTICLE_SEED[city.slug];
    if (!items || !items.length) continue;

    // One approved "launch editor" contributor per city — a clearly-labeled
    // seed account (not a real registered contributor) whose only purpose
    // is to author the illustrative launch articles above.
    const editorEmail = `launch-editor-${city.slug}@attractiontravelnews.com`;
    const existingEditor = await sql`SELECT id FROM users WHERE email = ${editorEmail} LIMIT 1`;
    let editorId;
    if (existingEditor.length) {
      editorId = existingEditor[0].id;
    } else {
      const passwordHash = hashPassword(crypto.randomBytes(24).toString("hex"));
      const inserted = await sql`
        INSERT INTO users (email, password_hash, role, status, display_name, bio, city_id, approved_at)
        VALUES (${editorEmail}, ${passwordHash}, 'contributor', 'approved', ${`${city.name} Launch Editorial Team`},
                ${`Illustrative launch account for ${city.name} — seeded sample content, not a live registered contributor.`},
                ${city.id}, now())
        RETURNING id
      `;
      editorId = inserted[0].id;
    }

    for (const item of items) {
      const category = categoryBySlug[item.category];
      const slugBase = item.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 80);
      const slug = `${slugBase}`;
      await sql`
        INSERT INTO articles (
          slug, title, excerpt, content_html, city_id, category_id, author_id,
          status, score, admin_feedback, image, image_alt, meta_title, meta_description,
          submitted_at, reviewed_at, published_at, updated_at
        ) VALUES (
          ${slug}, ${item.title}, ${item.excerpt}, ${item.html}, ${city.id}, ${category ? category.id : null}, ${editorId},
          'published', 9, 'Launch content — approved for site opening.', ${item.image}, ${item.imageAlt},
          ${item.title + " | " + city.name}, ${item.excerpt},
          now(), now(), now(), now()
        )
        ON CONFLICT (slug) DO NOTHING
      `;
      articleCount++;
    }
  }
  console.log(`articles: seeded ${articleCount} row(s) across ${cities.length} cities.`);
}

// Performance audit findings — two real query patterns that were doing a
// full scan-and-sort against `articles` with no supporting index:
//   1. Every public "published, newest first" read (homepage sections,
//      /latest-news, /categories/[slug], getTrendingArticles, etc.) filters
//      status = 'published' and orders by published_at DESC. The existing
//      `articles_status_idx` covers the filter but not the sort, so
//      Postgres still sorted the full published set on every query as that
//      table grows. A composite (status, published_at DESC) index lets it
//      walk the index in the exact order needed instead.
//   2. Category-filtered reads (getPublishedArticlesPage with
//      categorySlug, the /categories/[slug] page, category articles
//      counts) join through category_id with no index backing that join
//      column at all — every one of those was a sequential scan over
//      `articles`. Indexed now, same as city_id and attraction_id already
//      were.
// CREATE INDEX IF NOT EXISTS is idempotent, like every other statement in
// this script — safe to re-run against a database that already has these.
async function addPerformanceIndexes() {
  console.log("Ensuring performance indexes exist...");
  await sql`CREATE INDEX IF NOT EXISTS articles_status_published_idx ON articles (status, published_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS articles_category_idx ON articles (category_id)`;
  console.log("Performance indexes ready.");
}

// Backs incrementArticleView() (lib/articles.ts): one view per unique IP
// per article, not one per page load. UNIQUE(article_id, ip_hash) is the
// entire mechanism — it's what the article-view write's ON CONFLICT DO
// NOTHING targets, so a repeat visit from the same IP is a no-op insert
// instead of a second row, and it's also naturally the exact index that
// write's WHERE-equivalent lookup needs, so no separate index is required.
// ip_hash stores a one-way SHA-256 hash, never the raw IP.
async function createArticleViewsTable() {
  console.log("Ensuring article_views table exists...");
  await sql`
    CREATE TABLE IF NOT EXISTS article_views (
      article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      ip_hash TEXT NOT NULL,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (article_id, ip_hash)
    )
  `;
  console.log("article_views table ready.");
}

async function createIndexingSettingsTable() {
  console.log("Ensuring indexing_settings table exists...");
  await sql`
    CREATE TABLE IF NOT EXISTS indexing_settings (
      key TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      no_index BOOLEAN NOT NULL DEFAULT false,
      no_follow BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  console.log("indexing_settings table ready.");
}

async function main() {
  await createTables();
  await addPhase1Columns();
  await addPhase2Columns();
  await createPhase4Tables();
  await addPhase4Columns();
  await createPhase5SecurityTables();
  await dropEventsTable();
  await createArticleViewsTable();
  await createIndexingSettingsTable();
  await createPhase7EmailVerificationColumns();
  await createPhase8OwnerPasswordColumn();
  await createPhase9FooterConfigColumn();
  await addCountrySlugColumn();
  await addPerformanceIndexes();
  await backfillUserSlugs();
  await seedCities();
  await seedCategories();
  await seedLaunchEditorsAndArticles();
  console.log("\nDone. Your database is ready.");
  console.log(
    "\nReminder: the Admin Panel's first login uses ADMIN_EMAIL / ADMIN_PASSWORD from your .env — see README.md. " +
      "You can change that password afterward from Admin -> Settings, no redeploy needed."
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nSetup failed:", err);
    process.exit(1);
  });
