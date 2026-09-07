# Attraction Travel News

Latest news from attractions around the world — a city-based news portal with three areas:

- **Public website** — homepage news feed, per-city pages, per-article pages, category filtering.
- **Contributor dashboard** (`/contributor/dashboard`) — approved contributors submit and track their own city's articles. Old `/dashboard/*` bookmarks still work — they redirect to the matching `/contributor/*` path.
- **Admin panel** (`/admin/overview`) — manage users, articles, cities, categories, and publishing.

Built as a fresh Next.js 14 App Router project with its own theme, brand, and page structure — this is a separate codebase from any other site in this workspace, sharing only general technical lessons (image optimization, the Neon caching gotcha below, SEO structure, and auth patterns).

## How the city system works

- Every article belongs to exactly one city (`articles.city_id`), chosen by the contributor from a dropdown of real cities when they submit or edit it — validated server-side against the `cities` table on every save.
- Contributors are not tied to a single city — one approved contributor can write about any city on the site, picking a different one per article if they like.
- City pages (`/cities/[slug]`) only show published articles for that city; the query is filtered server-side, so there's no way for an article to leak into the wrong city's page. Article URLs are `/cities/[citySlug]/[articleSlug]`.
- Admins manage the list of available cities from **Admin → Cities**.

## How the approval workflow works

1. Someone signs up at `/signup` (email/password, or one-click Google). Their account is created with `status = pending` and they cannot log in yet — Google signup goes through the exact same approval gate, it just sends them to `/pending-approval` after the Google redirect instead of a form.
2. An admin reviews the registration at **Admin → Users** and approves or rejects it.
3. Once approved, the contributor logs in at `/login` and can submit articles for any city — always written directly on the site (no field to paste an external link or URL). Drafts autosave; submitting runs a local originality/duplicate-content check first.
4. Every submission starts as `pending`. An admin reviews the actual content at **Admin → Articles**, gives a 0–10 score with optional feedback, and approves or rejects it.
5. An approved article isn't live yet — the admin still has to hit **Publish**. This is deliberate: "approved" and "live on the public site" are two separate states.
6. If rejected, the contributor sees the feedback on their dashboard and can edit (including changing the city) + resubmit, which puts it back to `pending`.

## Local setup

```bash
npm install
cp .env.example .env
# fill in .env — see the comments in that file
node scripts/setup-db.mjs
npm run dev
```

`scripts/setup-db.mjs` creates every table and, on a fresh database, seeds 5 launch cities (Barcelona, Amsterdam, Paris, Rome, London), 5 categories, and 2 illustrative sample articles per city so the site isn't empty on day one. **Those seed articles are general, evergreen visitor-info pieces, not real reporting** — replace them with real contributor submissions once you have real approved users. It's safe to re-run this script any time; it only creates what doesn't already exist.

### First login

Use the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env` to log in at `/admin/login` — this "owner" account always works, even before any row exists in the `users` table. From there, promote other users to admin at **Admin → Users** if you want more than one admin.

Once logged in, change the owner password from **Admin → Settings** instead of editing `ADMIN_PASSWORD` and redeploying — it overrides the env value from then on (stored as a hash on the `settings` table). `ADMIN_PASSWORD` only matters for that very first login, before an override has been set.

### Important: don't reuse credentials from other projects

If you've built other sites in this workspace, **do not** point this app's `DATABASE_URL` or `BLOB_READ_WRITE_TOKEN` at the same Neon project / Blob store those use — create new ones for this project. Reusing them would mean both apps read and write the same tables and files.

## The contributor user system (Phase 1)

- **Signup/login**: `/signup` and `/login` support both email/password and one-click Google Sign-In. Every new account — however it signs up — is created with `status = pending`; nothing about Google sign-in skips the admin approval gate.
- **Email verification gates admin visibility, for password signups only** (`lib/users.ts`'s `emailVerified` column, `/verify-email`, `/api/auth/verify-email`): a password signup gets a 24-hour verify link instead of the "you're pending approval" email; only after clicking it does that email go out *and* does the account become visible to admins as a reviewable application (`app/admin/(dashboard)/page.tsx`, `UsersTable.tsx`, and `UserDetailPanel.tsx` all filter/hide the Approve/Reject actions on an unverified `pending` account — enforced server-side too, in `/api/admin/users/[id]`, not just hidden in the UI). Google sign-in skips this entirely — a Google account is created with `emailVerified = true` immediately, since Google already verified the address before this app ever saw it, and goes straight to `/pending-approval`.
- **Google Sign-In** is optional. It's implemented as a direct OAuth 2.0/OIDC authorization-code-flow (`lib/googleAuth.ts`, `/api/auth/google`, `/api/auth/google/callback`) rather than a client library, so there's no extra dependency to trust. Without `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set, the button shows a clear error instead of a broken redirect. See `.env.example` for the exact setup steps.
- **Google reCAPTCHA v2** on `/signup`, `/login`, and `/admin/login` (`lib/recaptcha.ts`, `components/Recaptcha.tsx`) is optional bot/abuse protection layered on top of the existing per-IP rate limiting. Without `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`/`RECAPTCHA_SECRET_KEY` set, the widget doesn't render and no verification is required, on both the client and server side — see `.env.example` for setup. If the widget itself fails to load client-side (e.g. blocked by a DNS filter), the form detects it and lets the visitor continue anyway rather than getting hard-locked out; the server mirrors that by failing open on a missing token too, so rate limiting remains the real backstop.
- **Forgot/reset password** (`/forgot-password`, `/reset-password`) and **email verification** share the same token design: single-use, hashed with SHA-256 before storage (`lib/tokens.ts`), never stored or emailed in plain text. The forgot-password endpoint always responds the same way whether or not the email is registered, so it can't be used to check who has an account. Actual email delivery goes through `lib/email.ts` (Resend), which needs `RESEND_API_KEY` set to send anything — without it, every email is logged to the server console instead (and the reset link is also returned directly in the API response outside production, for local testing).
- **Draft-first article editor** (`/contributor/articles/new`, `/contributor/articles/[id]/edit`): a new article starts as an unsubmitted `draft` and autosaves every ~2.5s. Only an explicit "Submit for Review" moves it to `pending` — nothing is ever silently submitted for the contributor.
- **Originality/duplicate-content check** (`lib/originality.ts`): a local word-shingle similarity check against every other article already in this database — real, working duplicate detection scoped to this site's own content, but it does *not* check the wider web. It's intentionally written as a pluggable `checkOriginality()` function so it can be swapped for a real third-party plagiarism API later without touching any call site. Flagged submissions still go through — they're never silently blocked or auto-rejected — but the contributor sees a warning before confirming, and the flag is stored for admin review.
- **Points/scoring** is user-side display only in this phase (`/contributor/points`) — it reads whatever score/feedback the Admin Panel has already recorded. The Admin Panel's actual scoring UI is a separate, later phase.

## The Admin Panel (Phase 2)

Everything under `/admin` reads and writes the same database the public site and contributor dashboard use — there are no fake/static numbers anywhere in the Admin Panel; every count, chart, and table is a live query.

- **Two admin identities**: the `.env` "owner" account (`ADMIN_EMAIL`/`ADMIN_PASSWORD`) always works and isn't a database row — it's the fallback for a fresh install. Any user can also be promoted to `role = admin` from **Admin → Users**; those accounts *are* database rows, and only they can change their password from **Admin → Settings** (the owner account's credentials are only ever changed via environment variables, by design — the settings page explains this rather than pretending to support it).
- **User approval/suspension** (`/admin/users`, `/admin/users/[id]`): approve, reject, suspend, or reactivate — the available actions are always computed from the user's current database status (see `actionsFor()` in `components/admin/UsersTable.tsx`), so an already-approved user never shows an Approve button again, and this stays correct across refreshes because it's read from the database, not local state. `suspended` is a distinct status from `rejected` — suspended means "was approved, now blocked"; rejected means "never approved." Both block login, with different messaging.
- **Article review workflow** (`/admin/articles`, `/admin/articles/[id]`): pending → admin scores (0–10) + approves/rejects → admin publishes/unpublishes. A published article can't be re-approved/rejected directly from the Review panel (or the API) — it has to be unpublished first, which cleanly returns it to `approved`. This stops `status` and `published_at` from ever drifting out of sync. Admin edits support tags, SEO title/description, focus keyword, canonical URL, and a slug override beyond what the contributor's own editor exposes.
- **Points & Scoring** (`/admin/points`): reads the same `articles.score`/`admin_feedback` columns the contributor's own `/contributor/points` page reads — a score given here is visible to the contributor immediately on their next load, no separate sync step.
- **Settings** (`/admin/settings`) is just the admin's own profile/password change now. A sitewide meta-description/OG-image/robots-directive/featured-cities settings row used to live here too, but every one of those fields either duplicated per-page SEO (which already lives directly on each article/city and always takes precedence) or was never actually filled in, so the form was removed rather than kept around unused. The underlying `settings` table (and its now-unused columns) is left in place — see `lib/settings.ts`.
- **Activity Log** (`/admin/activity`): every meaningful admin mutation (approvals, rejections, suspensions, scores, publish/unpublish, edits, deletes, city/category/event/settings changes) is recorded via `lib/activity.ts` and shown here with filters by admin, target type, date, and free text. Logging is best-effort — a logging failure never blocks the actual action.
- **Defense in depth**: `middleware.ts` already blocks non-admin sessions from every `/admin/*` and `/api/admin/*` route, and every individual admin API route handler also checks `session.role === "admin"` itself, so a route is never accidentally left open if the middleware matcher config ever changes.

## The public website (Phase 3)

The full public site is city- and category-organized, entirely database-driven, and shares the same editorial (warm-paper/near-black-ink/crimson-signal, serif-headline) design system introduced in Phase 1 — deliberately distinct from the cool slate/navy palette used across the other travel-booking sites in this workspace, extended here rather than replaced.

- **Homepage** (`app/(public)/page.tsx`): masthead + hero story, Top Stories, Trending Now (last-30-days published articles ranked by the admin's own 0–10 score, falling back to the most recent published articles if nothing scored in that window — a real signal, not a fabricated "popularity" number), Popular Cities (ranked by genuine published-article count), up to 3 category sections, Popular Attractions ("Reader Favorites" — all-time top-scored articles), a Latest News grid, and a newsletter signup. Every section reads live from the database; an empty site shows an honest empty state instead of placeholder content.
- **Cities** (`/cities`, `/cities/[citySlug]`): index shows every city with a real article count and its actual latest headline; the individual page has a featured story, category filter pills, "Popular in {city}" (top-scored within that city), and related cities — all scoped so an article only ever appears under its real city.
- **Categories** (`/categories`, `/categories/[categorySlug]`): same pattern, plus real pagination (`getPublishedArticlesPage()` — a genuine `COUNT(*)` + `LIMIT/OFFSET` query, not a client-side slice of a capped list) and a "Related Cities" block derived from the actual articles on the page.
- **Latest News** (`/latest-news`): the full paginated, filterable (city/category/search) feed of every published article, newest first.
- **Search** (`/search`, `lib/search.ts`): real `ILIKE` search across article title/excerpt/body/tags plus city and category names — not a fake "no results" screen. Every `/search` variant is `noindex` (its content is entirely query-dependent), and it's excluded from the sitemap; it's intentionally still crawlable (not `robots.txt`-disallowed) so the per-page `noindex` meta tag is actually seen rather than blocked from being read at all.
- **Article pages**: tags, a genuine "Updated" date (only shown when the article was actually edited more than a minute after publishing — never a cosmetic refresh stamp), social sharing (X/Facebook/WhatsApp/email/copy-link, all real share targets), a newsletter CTA, and separate "More from this city" / "More in this category" rails.
- **Contact form** (`/contact`, `lib/contactMessages.ts`, `contact_messages` table): real validation, a honeypot field for basic spam protection, and persistence — a submission is never silently discarded, even if `RESEND_API_KEY` isn't configured to also email the editorial inbox.
- **Newsletter signup** (footer, homepage, and after every article; `lib/newsletter.ts`, `newsletter_subscribers` table): real persistence with duplicate-email handling. No campaign-sending system is included — this only captures who asked to be notified.
- **Write for Us** (`/write-for-us`) and the expanded **About** page cover the real editorial process (apply → write on-site only, no external-URL submissions → originality check → review & score → publish) instead of vague marketing copy.
- **Legal pages**: `/privacy-policy` (expanded to cover contact-form and newsletter data), `/terms-and-conditions`, `/cookie-policy` (accurately states there's exactly one cookie — the session cookie — and no consent banner, because there's nothing to track), `/editorial-policy`, `/disclaimer`.
- **Error/empty/loading states**: `app/error.tsx` (in-layout error boundary with Retry), `app/global-error.tsx` (root-layout-failure fallback, renders its own `<html>`/`<body>` per Next's requirement), `app/(public)/not-found.tsx` (on-brand 404 with search + quick links) and `app/not-found.tsx` (root fallback for routes outside the public layout), `app/(public)/loading.tsx` (skeleton shown during navigation), and `EmptyState`/`Pagination`/`SectionHeading` shared components used consistently across every listing page.
- **SEO**: per-page canonical/OG/Twitter via `buildMetadata()` (now also honors an admin-set canonical override), `WebSite` schema with a `SearchAction` on the homepage, `BreadcrumbList` on every page, `ItemList` on city/category listing pages, `NewsArticle` on article pages, and `Organization` sitewide. `sitemap.ts` includes every static page, city, category, and published article; paginated/filtered variants of `/latest-news` and `/categories/[slug]` are `noindex` rather than fighting page 1 for the same search queries.
- **What's honestly not here**: FAQ schema is not added anywhere, because there's no FAQ content model to back it — adding the schema without real Q&A data would be exactly the kind of fake markup this project avoids elsewhere.

> Note: the "no distinct attraction entity" line that used to be here is no longer accurate — the Final Phase below adds a real `attractions` table (City → Attraction → Article). "Popular Attractions" on the homepage is still a quality-score ranking of articles, kept as-is; it's independent of the new Featured/Editor's Picks sections described below.

## Final Phase — production readiness

Everything in this section extends the system above without changing any of its existing behavior — original statuses, routes, and data keep their original meaning; everything here is additive (new columns, new tables, new optional fields).

### Editorial workflow (extended)

Status now moves through `draft → pending (submitted) → under_review → changes_requested → pending (resubmitted) → approved → scheduled → published → unpublished`, plus `rejected` off of `pending`. The original five statuses (`draft`, `pending`, `approved`, `rejected`, `published`) keep exactly their original meaning — `under_review`, `changes_requested`, `scheduled`, and `unpublished` are new. An admin moves an article between these from **Admin → Articles → [article]**: **Start Review** (pending → under_review), **Approve / Request Changes / Reject**, **Publish Now** or **Schedule** (approved/unpublished → published/scheduled), **Cancel Schedule**, **Unpublish**. When an admin requests changes, the contributor sees the feedback on their dashboard article page and gets an "Edit & Resubmit" link; resubmitting goes back to `pending`.

### Revision history

Every meaningful save — a contributor's submission, an admin's edit, or an admin's restore — snapshots the full article (title, excerpt, body, image, editor, timestamp, a short change summary) into `article_revisions`. Draft autosaves do **not** create revisions (that would flood the table with every keystroke); only submit/edit/restore do. From the Article Review page's **Revision History** panel, an admin can restore any older version — restoring itself creates a new revision first, so the version you're replacing is never lost. Review decisions are separately logged (who, when, what decision, what score, what moderation signals were showing) in `article_reviews`, an append-only audit trail distinct from the current `articles.score`/`admin_feedback` columns.

### Scheduled publishing

An approved (or previously unpublished) article can be scheduled for a future date/time instead of published immediately. Scheduled articles publish themselves automatically — this is enforced two ways, not just a UI trick: (1) a dedicated cron endpoint at `/api/cron/publish-scheduled`, wired up in `vercel.json` to run every 5 minutes via **Vercel Cron** (protected by a `CRON_SECRET` bearer token — set it in your environment variables; Vercel Cron sends it automatically), and (2) defensively on every public content read (`getPublishedArticles`, `getPublishedArticleBySlug`, etc. all call the same publish-check first), so even if the cron job were ever delayed, the next real visitor to any public page still triggers the catch-up. Canceling a schedule returns the article to `approved` without touching anything else.

### Featured / Trending / Editor's Pick / Breaking

Four independent booleans an admin sets per article from the **Editorial Placement** panel on the Article Review page — not computed guesses. The homepage reads them directly: a **Breaking** banner strip (if any), a **Featured Stories** section, the existing algorithmic **Trending Now** section (last-30-days quality-score ranking — unchanged), and **Editor's Picks**. An article can carry any combination of these flags regardless of its review status; they only actually render once it's published.

### Author pages

Every user gets a stable, unique slug (`users.slug`, generated at registration, backfilled for pre-existing accounts by `scripts/setup-db.mjs`). `/author/[slug]` shows their name, avatar, bio, published-article count, the cities they've covered, and a grid of their published work. A page 404s for an unknown slug, and for a real account with zero published articles (unless that account is an admin) — never a fabricated "coming soon" profile. Every published article links to its author's page from both the admin review panel and the public article byline.

### Attraction-level content structure

A new `attractions` table sits between city and article: **City → Attraction → Article**. Manage attractions from **Admin → Attractions** (name, description, hero image, meta title/description, sort order, scoped to one city). An article can optionally be tied to a specific attraction from the contributor editor or the admin review panel — a contributor can still write a general city-level piece with no attraction, and can write about any city/attraction, not just one they're "assigned" to. Public pages: `/cities/[citySlug]/attractions` (index) and `/cities/[citySlug]/attractions/[attractionSlug]` (detail, with its own articles and a "More about {attraction}" rail on article pages).

### Content moderation signals

`lib/moderation.ts` runs five real, local checks on every submission — duplicate/similarity (reusing the existing shingle-based originality check), spam (link density, ALL-CAPS ratio, repeated punctuation, a keyword list), inappropriate-content keywords, a quality score (word count, structure, excerpt/title completeness), and an AI-generated-content heuristic (stock-phrase and sentence-length-uniformity detection). All five are cached on `articles.moderation_signals` and shown to the admin in a collapsible **Moderation Signals** panel on the review page — **these are signals only and never auto-reject or auto-flag anything as final**; the admin always reads and decides on the actual article.

### Notifications

`notifications` table + `lib/notifications.ts`: every workflow event (account approved/rejected, article submitted/under review/changes requested/approved/rejected/scored/published/unpublished) creates a real in-app row and best-effort emails the user via `lib/email.ts` (same graceful-degradation behavior as password reset — without `RESEND_API_KEY` it logs instead of sending, and the `email_sent` column records that honestly). The dashboard header has a live unread-count bell with a dropdown; the full history lives at `/dashboard/notifications`, linked from the sidebar.

### Newsletter

Unchanged in structure from Phase 3 (`newsletter_subscribers`, real persistence, no delivery service wired) — `unsubscribed_at` was added to the schema so an admin management view or an unsubscribe link can be built directly on top of it without another migration.

### Analytics & SEO

There's no Google Analytics/Search Console integration and no sitewide meta-description/OG-image/robots fallback — those were admin-configurable in an earlier version (`Admin → Settings`) but were never actually set, so they were removed rather than kept as dead form fields. **No fake view counts or placeholder charts are shown anywhere.** Real per-article view counts (`articles.view_count`, incremented once per real public page render) already exist as the honest foundation for a future "popular articles" report. Every public page (including the new author and attraction pages) has its own canonical/OG/Twitter metadata and JSON-LD (`BreadcrumbList` plus `NewsArticle`/`Organization`/`WebSite`/`Person` as applicable), and per-page index/noindex is controlled directly via the Indexing admin page (`lib/indexing.ts`); `sitemap.ts` includes attraction pages and author pages alongside everything from Phase 3.

### Security hardening

- **Rate limiting**: `lib/rateLimit.ts` is a real, database-backed limiter (a `rate_limits` table, atomic per-row Postgres upsert) — deliberately not in-memory, since serverless functions don't share memory across instances and an in-memory counter would silently do nothing in production. Applied to `/api/auth/login` (8/10min), `/api/auth/admin-login` (6/15min), `/api/auth/signup` (5/hour), `/api/auth/forgot-password` (5/hour), and `/api/auth/reset-password` (10/30min), all keyed by IP. Fails open (allows the request) if the rate-limit table itself can't be reached, so it can never become a new way to break login.
- **Stored-XSS protection**: `lib/sanitizeHtml.ts` is a server-side allowlist sanitizer applied to `content_html` on every write path (draft save, submit, admin edit, revision restore) — regardless of what the rich text editor's UI would normally produce, a raw API request can't smuggle a `<script>`, an `onerror=` handler, or a `javascript:` URL into an article body. Only a small set of real content tags/attributes are kept; everything else is stripped.
- **Access control audit**: every `/api/admin/**` route checks `session.role === "admin"` before touching any data (including all the routes added in this phase — attractions, events, notifications are dashboard-scoped, the cron endpoint); every `/api/dashboard/**` by-ID route checks both in the handler and at the SQL `WHERE` clause that the record belongs to the logged-in user. `middleware.ts` additionally blocks non-admin sessions from `/admin/*` and `/api/admin/*` as a second layer.
- Password hashing (scrypt via `lib/passwords.ts`), password-reset tokens (single-use, hashed, time-limited), and image upload validation (type/MIME/size/dimension caps) were already in place from earlier phases and are unchanged.

## Known technical gotchas (carried forward from earlier projects)

- **Neon's HTTP driver + Next.js fetch caching**: `lib/db.ts` sets `fetchOptions: { cache: "no-store" }` on the `sql` client. Without this, Next can silently cache database *query responses* themselves — a save succeeds but a subsequent read can serve stale cached data. Already handled here; don't remove it.
- **Browser caching admin/dashboard HTML**: `middleware.ts` sets `Cache-Control: no-store` on every response, so an admin publish or a contributor edit is visible on a normal refresh, not just a hard refresh.
- **Images**: every upload (contributor article covers, admin city heroes) goes through `lib/blob.ts`, which re-encodes to WebP and caps the longest edge at 2000px server-side with `sharp` before it ever reaches Vercel Blob — there's no code path that accepts a pasted external image URL.
- **No `next build` run in this environment**: this project's build could not be verified with a live `next build` in the sandbox it was built in (no npm registry access there — `next build` tries to download a platform-specific `@next/swc` binary and fails with `EAI_AGAIN`). It was verified with `tsc --noEmit` (clean after Phase 1, Phase 2, and again after the full Phase 3 public website) and a full manual code review instead. Run `npm run build` yourself before deploying to catch anything a type-check alone can't.
- **Google OAuth `google_failed` after a redirect-URI fix**: if "Continue with Google" gets past a `redirect_uri_mismatch` but then lands on `/login?error=google_failed`, the callback route (`app/api/auth/google/callback/route.ts`) now logs the real underlying error server-side (`console.error("[google oauth callback] failed:", err)`) — check your terminal for that line. The most common cause is `scripts/setup-db.mjs` not having been (re-)run against your database since the `google_id`/`auth_provider`/`avatar_url` columns were added, since `findOrCreateGoogleUser()` needs them. It's safe to re-run that script any time.

## Deploying

1. Push to a git provider, import into Vercel.
2. Add all the variables from `.env.example` to the Vercel project's Environment Variables (Production + Preview).
3. Run `node scripts/setup-db.mjs` once against your production `DATABASE_URL` (either locally with that URL in `.env`, or via `vercel env pull` first).
4. Deploy. Log into `/admin/login` with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
# attraction-travel-news
# world-attraction-news
