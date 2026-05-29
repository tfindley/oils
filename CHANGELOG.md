# Changelog

All notable changes to Potions & Lotions are documented here.

## [Unreleased]

Four accumulated phases on the `v1.2` branch toward a multi-user release. Phases stack additively — nothing prior breaks; anonymous saves keep working unchanged.

### Added

#### v1.4.x — Polish from real-use feedback

- **No accidental remove from the oil browser.** The "🛒 In my collection" button on `/oils/[id]` no longer toggles off on click — it became a **🛒 In my collection — view** link to `/my-collection#oil-<id>`. Removing an oil now only happens explicitly from the collection page itself. The anchor jumps you to the row AND auto-opens its edit form.
- **Per-user currency** (ISO 4217). New `User.currency` column, defaults to `GBP` for back-compat. **/account → Profile** gets a Currency dropdown covering GBP, EUR, USD, CAD, AUD, NZD, CHF, SEK, NOK, DKK, JPY, INR. Costs throughout `/my-collection` now format via `Intl.NumberFormat` using the user's chosen currency — Belgian users see €, Japanese users see ¥, etc. Switching currency doesn't convert existing values; the user re-enters them.
- **Bottle size as cost context** — new `UserOilCollection.bottleSizeMl` column. The collection edit form gains a **Bottle size (ml)** field next to **Price paid**, and the row summary renders them together: "€12.50 for 30 ml" instead of a contextless "€12.50". Lays groundwork for future cost-per-blend computations (`cost / bottleSizeMl × usedMl`).
- New shared helper [lib/currency.ts](lib/currency.ts) — `CURRENCIES`, `formatCurrency()`, `isSupportedCurrency()`, `DEFAULT_CURRENCY`. Adding a currency to the dropdown is one entry in `CURRENCIES`; nothing else changes.

### Fixed

- **`/account` profile form fields reverted on save.** React 19 resets uncontrolled form fields after a server action completes; combined with `revalidatePath()` not propagating the new prop to the same render cycle, the currency `<select>` appeared to flip back to its previous value even though the DB was updated. Converted firstName / lastName / currency to controlled inputs with `useEffect` prop-sync — the user's selection now survives the post-action reset, and a later server re-render still wins.

#### v1.4.x — Operator maintenance mode + JWT-callback hardening

- **`Settings.maintenanceMode` operator kill-switch.** When on, `proxy.ts` rewrites all public requests to a friendly `/maintenance` page; `/admin/*` stays reachable so the operator can flip it back off. `/api/auth/*` and `/api/cron/*` are exempt (Auth.js handlers and bearer-auth'd cron jobs keep functioning). Public `/api/*` requests get a 503 JSON with `Retry-After` instead of an HTML rewrite.
- **Dedicated `MaintenanceModeCard`** on `/admin/settings` — separated from the cosmetic toggles, has its own action (`toggleMaintenanceModeAction`), a JS `confirm()` dialog before engagement (because clicking on accident takes the site offline), three expandable info panels ("what does maintenance mode do?" / "how do I access the site once engaged?" / "how do I disable it afterwards?"), and a status banner showing the current state. Saving the cosmetic-toggles form no longer touches `maintenanceMode` so the two flows can't accidentally collide.
- **Hardened `auth.ts` JWT callback.** The `lastSignInAt` stamping is now wrapped in `try/catch`; if the update fails (schema drift, transient DB blip), the callback falls through to a read-only `findUnique` so the user can still sign in. Previously a missing v1.3.0 column would surface to the user as a misleading "Email or password incorrect" error.
- **`proxy.ts` matcher broadened** to cover the whole site (with explicit exemptions for `_next/static`, `_next/image`, `_next/data`, favicons, manifest, robots.txt, sitemap, common asset icons). The admin-gating logic stays scoped to `/admin/*` only.

#### v1.4.0 — Personal oil collection

- **New `UserOilCollection` Prisma model** — per-user oil inventory with optional quantity (ml), opened-at, expires-at, supplier, cost, batch number, and freeform notes. `@@unique([userId, oilId])` blocks duplicates; FK is `ON DELETE CASCADE` from User, `RESTRICT` from Oil.
- **`/my-collection` page** — list/grid of the user's oils with inline edit (quantity / opened / expiry / supplier / cost / batch / notes), expiry badges, type filter (All / Carriers / Essentials), search across name + supplier + batch + notes.
- **Stats strip** at the top: Total oils (with carrier / essential split), Total spend (sum of `cost`), Expiring soon (within 30 days), Library coverage.
- **Expiry detection**: explicit `expiresAt` wins; otherwise derived from `openedAt + Oil.shelfLifeMonths` (carriers only). Anything ≤30 days from expiry gets an amber badge; past-expiry gets a red badge.
- **"Add to my collection" / "🛒 In my collection" toggle button** on every `/oils/[id]` page, next to Add-to-Blend / Add-to-Compare. Signed-out users see a "Sign in to track" CTA instead.
- **"From my collection" filter chip** in the blend builder's oil picker (both Carriers and Essentials tabs). Renders only when the user has at least one oil of that type in their collection. Lets you build blends scoped to oils you actually own — the killer feature of having a collection.
- **Shopping list card** on every `/blend/[id]` recipe page for signed-in viewers: shows which of the blend's oils you don't own yet, with a per-oil "Buy ↗" link (uses `Oil.buyUrl`). Includes a "You have X of Y in this recipe" footer. Hidden entirely when you own everything (replaced by a ✓ note).
- **Nav**: "My Collection" link in the avatar dropdown and mobile menu, alongside My Blends.

#### v1.1.0 — Auth foundation

- **Auth.js v5 + Prisma adapter** wired up with JWT sessions (required by the Credentials provider).
- **Email + password signup** at `/signup` with first-name + last-name required (1–50 chars, no leading/trailing whitespace). User.name defaults to `"First Last"` on creation; the format is editable on `/account`.
- **Email verification** via `/verify-email?token=…`; tokens are hex-64, single-use, 24-hour TTL; success redirects to `/login?verified=1` (the email address is intentionally NOT carried in the URL so it doesn't leak via browser history or Referer).
- **Sign in / sign out** at `/login` and `/logout`; `/logout` is **POST-only** (CSRF-safe; UserMenu posts via a `<form>`). Login surfaces `verified=1`, `passwordChanged=1`, `check=email`, and token-error flags.
- **Forgot / reset password** at `/forgot-password` and `/reset-password?token=…` with anti-enumeration (silent-ok responses).
- **Account page** at `/account` with editable first/last name, display-name picker, change-password (current + new), and delete-account.
- **Display-name picker** with five presets: `First Last`, `Last, First`, `First L.`, `F. Last`, **Anonymous** (always available), plus Custom/nickname. Pre-selects the matching preset on render; rendered choice is what shows as the "by …" line on every blend.
- **Email transport (`lib/email.ts`) — three-tier**: Resend (if `RESEND_API_KEY` is set), Nodemailer SMTP (if `SMTP_HOST` is set), or dev-console fallback in non-prod. Production throws if neither real transport is configured.
- **Rate limiting** on signup (3/hour/IP) and password reset (3/day/email).
- **Header & nav**: session-aware. Logged-out users see Sign in / Sign up; logged-in users get an avatar dropdown with My Blends, Account settings, Sign out, and an ⚙ Admin panel link when `role === 'ADMIN'`. Mobile menu mirrors all of it.

#### v1.2.0 — Blend ownership

- **`Blend.userId`** (nullable FK, ON DELETE SET NULL — deleted users' blends become anonymous instead of dropping).
- **`Blend.isShared`** (default `false` for owned blends; anonymous blends ignore it).
- **`Settings.allowAnonymousSaves`** admin toggle (default on; turn off to require sign-in before saving).
- **POST /api/blends** attaches `userId` for authed saves, gates anonymous saves on the Settings flag.
- **`/blend/[id]` access control**: anonymous blends are public by URL; owned blends are public only when `isShared` is true OR the viewer is the owner. Non-owners hitting a private blend get a 404 with no existence leak.
- **`/my-blends`** page lists the current user's saved blends.
- **Owner share toggle** on the blend detail page — flip a saved blend public/private.
- **Claim flow** for users who saved a blend anonymously before signing up — URL-only auth; a logged-in user viewing an unowned blend can claim it (atomic `updateMany` scoped to `userId: null`, so concurrent claims can't both win).

#### v1.2.1 — Admin user management + legacy admin login toggle

- **`/admin/users`** — list + search (email, name, first/last); per-row Promote / Demote / Mark verified / Make exempt / Delete; lockout guards refuse to demote or delete the last remaining `ADMIN`.
- **Legacy admin login kill switch** — once a `User`-account holds `ADMIN`, the admin can disable the `/admin/login` cookie path from **Site Settings**. The proxy then accepts only `ADMIN`-role sessions. The Settings page itself blocks disabling when zero admins exist.
- **`FORCE_LEGACY_ADMIN_LOGIN=1`** emergency env override re-enables `/admin/login` if user-based admin access is ever lost.
- **`proxy.ts`** accepts three paths into `/admin/*`: ADMIN-role JWT, legacy cookie (when allowed), or the login form itself.
- **`isAdminAuthenticated()` helper** in `lib/admin-auth.ts` — single source of truth for the three-path gate, used by admin server actions for defence-in-depth.

#### v1.3.0 — Account lifecycle + admin user stats

- **`/api/cron/account-purge`** (daily) — inactive-account purge with a warning trail. Users inactive ≥ 1y − 14d get a first warning; ≥ 1y − 3d get a final warning; ≥ 1y get deleted. Cascade: sessions/accounts drop; blends become anonymous (FK `SET NULL`). "Activity" = `lastSignInAt` if set, else `createdAt`.
- **Sign-in resets the inactivity clock** — Auth.js JWT callback stamps `User.lastSignInAt = now()` AND clears both warning timestamps on every sign-in, so any sign-in within the window saves the account.
- **Inactivity warning email** (`lib/email.ts`) — same template for both warnings, day count interpolated.
- **`User.purgeExempt`** boolean (paid-tier hook now, useful for admin accounts immediately). Migration sets `purgeExempt = true` for all existing `ADMIN` users.
- **Admin Users page stats strip** — Total / Admins / Verified / Purge-exempt / Warned (amber-highlighted when >0) / Total blends. Always-visible context at the top of `/admin/users`.
- **Admin Users list** new columns: **Last sign-in** (relative time, "never" if null) and **Status** (🛡 Exempt / ⚠ Warned / ⚠ final badges). New **Make exempt / 🛡 Exempt** per-row toggle.
- **Owned blends are never auto-purged** — the existing `/api/cron/purge` (anonymous blend cleanup) now filters `userId: null`, so an account's saved blends persist for the lifetime of the account.

### Changed

- **Admin Blends list** (`/admin/blends`) — the Author column became **Owner / Display**, showing the owner's email (monospace, always shown for owned blends; `(anonymous save)` for legacy `userId=null` blends) above the public display name. Search now matches email + display name + legacy author name.
- **Admin Users list** desktop table header — the previously-duplicate `<th>Email</th>` second column now correctly says `Verified`.
- **Admin "Sign Out"** in the admin nav now signs out the NextAuth session in addition to clearing the legacy cookie, so ADMIN-role users don't get a redirect loop back to `/admin`.

### Fixed

- **Blend save form persisted the blend name across sessions.** On successful save, `BlendBuilder` cleared the draft from localStorage, but the post-save `oil-blender:draft-changed` cascade re-emptied React state in a way that retriggered the auto-save effect with `blendName` still set. The auto-save then wrote `{ carriers: [], essentials: [], blendName: 'Test' }` back to localStorage; the next visit to `/blend` re-hydrated the name. Two-part fix: the empty-check is now oils-only (a name without oils is not a blend), and `handleSave` resets `blendName`/`blendNotes` to `''` before navigation.

### Security

A `/simplify --fix` review pass on the v1.2 branch surfaced and fixed 14 issues before they shipped. None reached `main`; all were caught in the staging branch. Highlights:

- **`GET /api/blends/[id]` lacked access control.** Anyone with a blend ID could fetch the full recipe of a private (owned, `isShared=false`) blend via the JSON API even though the page route 404'd. Fixed by mirroring the page-route check at the API layer.
- **`/blend?from=<id>` lacked access control.** The "Build from this blend" clone path loaded any blend's volume / dilution / ingredients into the builder without checking ownership or share state. Fixed.
- **Admin server actions (promote/demote/verify/delete user, save settings) had no in-action role check** — they relied entirely on path-based proxy gating. Now each action calls `isAdminAuthenticated()` and bails on `false` (defence-in-depth against any future code path that bypasses the proxy matcher).
- **`/api/cron/purge` deleted user-owned blends** (would have silently destroyed saved blends after 30 days inactivity). Now filters `userId: null`.
- **`deleteAccountAction` had no last-admin lockout** (sole admin could self-delete via `/account` and lock the site out of admin). Mirrored the `/admin/users` guard.
- **`claimBlendAction` was TOCTOU.** Concurrent Claim clicks on the same anonymous blend could both pass the `userId === null` check; the second update would overwrite the first owner. Fixed by switching to an atomic `updateMany` scoped to `userId: null`.
- **`/admin/logout` only cleared the legacy admin_token cookie** — ADMIN-role JWT users got a redirect loop back to `/admin`. Now also calls `signOut()`.
- **Public blend listings (`/blends`, homepage)** had no `isShared` filter — an owned-private blend with `viewCount >= 5` or `isFeatured=true` would leak into the public grid. Added `OR: [userId: null, isShared: true]` to both.
- **Verified email address leaked in `/login?verified=1&email=…` URL** after verification. Dropped the email param.
- **GET-based `/logout` was CSRF-vulnerable** (cross-origin `<img src="/logout">`). Now POST-only.
- **Fail-open legacy admin gate.** `legacyAllowed = forceLegacy || settings?.legacyAdminEnabled !== false` evaluated to `true` when `getSettings()` errored and returned `null` (because `undefined !== false`). Fixed to fail-closed `=== true` in `proxy.ts`, `app/admin/layout.tsx`, and `app/admin/login/actions.ts`.
- **Dead `if (!secret) redirect('/admin')` branch** in `/admin/login/actions.ts` left over from the removed proxy escape hatch — would have created an infinite redirect loop in dev. Now returns an explicit error.
- **Duplicate `<th>Email</th>` column header** in the admin user list desktop table; the second one is meant to be `Verified`. Fixed.

A subsequent `/security-review` deep-dive on the patched branch found **zero new HIGH/MEDIUM-severity vulnerabilities**.

### Schema

Four additive migrations on the v1.2 branch:

| Migration | What changed |
|-----------|-------------|
| `20260526000000_v11_auth_foundation` | `User`, `Session`, `Account`, `VerificationToken` models per Auth.js v5 + Prisma adapter; `UserRole` enum |
| `20260526000001_user_firstname_lastname` | `User.firstName`, `User.lastName` (NOT NULL DEFAULT '') |
| `20260526000002_v12_blend_ownership` | `Blend.userId` (nullable, ON DELETE SET NULL); `Blend.isShared`; `Settings.allowAnonymousSaves` |
| `20260526000003_settings_legacy_admin_toggle` | `Settings.legacyAdminEnabled` (default true) |
| `20260529000000_user_lifecycle` | `User.lastSignInAt` (indexed), `User.purgeExempt`, `User.purgeWarningSentAt`, `User.purgeFinalWarningSentAt`; backfills `purgeExempt = true` for existing ADMINs |
| `20260530000000_user_oil_collection` | New `UserOilCollection` table: per-user inventory of owned oils with quantity/opened/expiry/supplier/cost/batch/notes. `@@unique([userId, oilId])`. ON DELETE CASCADE from User, RESTRICT from Oil. |
| `20260530000001_settings_maintenance_mode` | Added `Settings.maintenanceMode` (default `false`) — operator kill-switch for taking the public site offline. |
| `20260530000002_currency_and_bottle_size` | Added `User.currency` (TEXT NOT NULL DEFAULT 'GBP') and `UserOilCollection.bottleSizeMl` (FLOAT?) — per-user currency preference + bottle-size context for cost. |

## [1.0.0] — 2026-05-26

🎉 **First stable release.** No new code in this release — just a deliberate commitment to API stability.

From here:

- **Public URLs are stable.** `/blend/[id]`, `/oils/[id]`, `/blends`, every saved share link keeps working. No breaking URL changes without a 2.0.
- **Database schema is stable.** All future migrations are additive; saved blends keep loading.
- **Admin contract is stable.** `ADMIN_SECRET` env var, `/admin/login` flow, the HMAC session-token cookie pattern.
- **Public deployment is the canonical reference.** Image at `ghcr.io/tfindley/oil-blender:1.0.0` is treated as production-blessed.

### What 1.0 ships with

Everything accumulated since v0.0.1 — too much to itemise here, but the headline capabilities:

- Tabbed blend builder (Carriers / Essentials / Quantities / Save) with multi-carrier additive volume model, real-time A–F compatibility scoring, drift warnings, dilution presets.
- 55-oil library (30 essential + 25 carrier) with Claude-enriched profiles, ~96 curated pairings, EXCELLENT → UNSAFE rating system, hard-blocked unsafe combinations.
- Oil compare tool, drag-to-scroll compatibility matrix, aromatherapy glossary, oil profile pages with buy-link affiliate hooks.
- Shareable saved blends with permanent URLs, view tracking, 30-day auto-purge of inactive blends, featured-blend curation, PDF recipe-card download with QR code.
- Admin panel: oil CRUD with optional Claude-backed AI quick-add; blend management with search/import/promote; database tools; site settings (tooltip + footer-link toggles); responsive mobile UI.
- Account-less public model: anyone can save without signing up; localStorage-backed in-progress blend persists across pages; cross-page blend cart widget with live grade.
- Production hardening: HMAC-signed admin session tokens, constant-time auth, IP-keyed rate limiting on save + admin-login, HSTS + CSP-Report-Only + other security headers, URL-scheme validation, robots.txt, defensive `.gitignore` patterns, 30-day auto-purge.
- Operational: Docker image on GHCR, `node:22-alpine` base, multi-stage build with standalone output, in-container migration runner, automatic schema migrations on container start, systemd-timer auto-purge + Postgres backup documented, cross-host migration runbook documented.
- Privacy: per-page localStorage drafts never leave the browser; admin-toggleable help tooltips; UK/EU-aware privacy copy disclosing IP-based rate-limiting.

### Verification

`npm audit` clean (0 vulnerabilities). Latest Grype scan of `ghcr.io/tfindley/oil-blender:0.2.4`: 7 findings, all `Carried` (vendored inside Next.js / bundled in Prisma engines / Alpine BusyBox awaiting upstream patch). None reachable from app code at runtime. Full triage in [docs/SECURITY-RISK-REGISTER.md](docs/SECURITY-RISK-REGISTER.md).

Real-world tested by the project's massage-therapy class; no functional issues reported.

## [0.2.4] — 2026-05-25

### Security
- **Docker image vulnerability sweep.** Grype scan of `ghcr.io/tfindley/oil-blender:latest` (2026-05-25) reported 18 vulnerabilities — 0 critical, 11 high, 5 medium, 2 low. None were exploitable in our actual application usage (`tar`, `cross-spawn`, `glob`, `minimatch`, etc. are build-tooling / install-time utilities), but a clean scan is the right baseline.
- **`package.json` overrides** added to pin patched versions of 7 transitive npm dependencies:
  - `tar` → `^7.5.11` (5 high-severity path-traversal advisories)
  - `cross-spawn` → `^7.0.5` (ReDoS)
  - `minimatch` → `^9.0.7` (3 ReDoS advisories)
  - `glob` → `^10.5.0` (CLI command injection)
  - `brace-expansion` → `^2.0.3` (ReDoS + memory exhaustion)
  - `diff` → `^5.2.2` (DoS in `parsePatch`/`applyPatch`)
  - `ip-address` → `^10.1.1` (XSS in `Address6` HTML methods)
- **Docker base image bumped** from `node:20-alpine` to `node:22-alpine`. Resolves CVE-2025-60876 (BusyBox `wget` request-target validation) carried by the older Alpine layer in `node:20-alpine`. Node 22 is the current LTS and removes the impending Node 20 EOL deadline (April 2026).

### Internal
- Grype scan reports moved to `docs/security/` for historical reference.

## [0.2.3] — 2026-05-17

### Security
- **Bumped `next` 16.2.4 → 16.2.6** (and `eslint-config-next` to match). Resolves 13 advisories disclosed against 16.2.4–16.2.5, including:
  - Multiple Denial-of-Service issues (Server Components, Cache Components, Image Optimization API)
  - Middleware/Proxy bypass via segment-prefetch routes (incomplete-fix follow-up), dynamic route parameter injection, and Pages-Router i18n
  - Cache poisoning in RSC responses and in middleware redirects
  - XSS in App Router with CSP nonces, and in `beforeInteractive` scripts with untrusted input
  - Server-side request forgery via WebSocket upgrades
- `npm audit` now reports **0 vulnerabilities** (was 13 high + others on `npm audit` post-disclosure wave). Most of the listed advisories don't apply to our usage anyway — we don't run Cache Components, `beforeInteractive` scripts, websocket upgrades, or Pages-Router i18n — but patching to the fixed version is the right baseline.

## [0.2.2] — 2026-05-13

### Fixed
- **Admin panel mobile pass.** The admin surface was desktop-only; on an iPhone 14 Pro Max in portrait, the top nav overflowed off-screen, oil/blend tables clipped most columns, and the OilPairings table on the oil-edit page hid the Edit/Delete buttons. All resolved:
  - **`<AdminNav>`**: hamburger drawer below the `md` breakpoint. Drawer holds the four nav links plus "Back to Site" and "Sign Out"; closes on outside-tap or route change. Brand label stays visible alongside the hamburger.
  - **Oil Admin (`/admin`)**: card list on mobile (name + botanical + type badge in a header row; Enriched/Buy/Image indicators in a metadata row; right-aligned Edit). Header buttons stack vertically below the title.
  - **Blends Admin (`/admin/blends`)**: card list on mobile with checkbox + name/author + grade badge + view-count/dates + flag indicators + Edit/Delete actions. Search input now `w-full sm:w-72` so it stops forcing horizontal scroll.
  - **Oil-edit pairings table (`/admin/oils/[id]`)**: extracted edit-state into a `usePairingEdit` hook; mobile renders each pairing as a card with proper Save/Cancel/Edit/Delete buttons (not text-link hovers).
- All four admin surfaces keep their original desktop table layout at `sm+`; mobile gets the card variant. No data-model changes.

### Internal
- `.gitignore` defensive patterns added in v0.2.1 (`.private/`, `*.private`, `*.private.md`, `PLAN-PRIVATE*`, `PRIVATE-*`) are now committed (were previously local-only).

## [0.2.1] — 2026-05-09

### Added
- **Admin Settings page** at `/admin/settings` with toggles for "Help tooltips" (site-wide hint banners) and "Footer issue-reporting link" (the "Report it on GitHub" line). New `Settings` Prisma model — single-row, keyed by `id="singleton"`. New `lib/settings.ts` exposes `getSettings()` (cached per-request via `React.cache`) and `updateSettings()`. Settings link added to the admin nav.
- **`<HelpTooltip>`** generic hint banner (`components/ui/HelpTooltip.tsx`) with three independent off-switches: admin master kill (`siteEnabled`), per-page interaction signal (`interacted` — auto-dismisses when the user starts using the tool), and per-browser ✕-dismiss persistence in localStorage. Replaces the old `FirstVisitHint` (deleted).
- **Help tooltip on `/oils/compare`** below the slot selectors, explaining how to compare two oils. Auto-dismisses when either slot is filled.
- **Live search on the Oil Library** — `/oils` now filters as you type. New client component `components/oils/OilLibrary.tsx` owns search/type-filter state and renders results via `useMemo`. URL `?q=` and `?type=` still seed initial state for shareable filter links.

### Changed
- **`<BlendBuilder>`** — `<FirstVisitHint />` replaced by `<HelpTooltip id="blend-builder">`. Auto-dismisses when the user picks any oil OR moves off Tab 1. Admin-toggleable.
- **Footer** is now an async server component reading `getSettings()` to conditionally render the GitHub-issues line.

### Performance
- `getSettings()` does a `findUnique` first and only `create`s the row if it's missing, instead of upserting on every call. Wrapped in `React.cache()` so multiple callers within the same request (Footer + page) share one DB hit.

### Database
- New migration `20260509000000_settings_singleton` creates the `Settings` table. Auto-applied on Docker container start; for local dev, run `node scripts/migrate.js` once.

## [0.2.0] — 2026-05-09

Public-launch hardening pass: a publicly-reachable site needs more than localhost-grade security. This release closes 7 Dependabot advisories, adds a security-headers baseline (HSTS + CSP report-only), rate-limits both the public save endpoint and the admin login, decouples the admin cookie from `ADMIN_SECRET`, and ships a few class-trial-ready UX touches (homepage stats, admin blend search, first-visit hint).

### Added
- **Security headers** in `next.config.ts` — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, **`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`**, and **`Content-Security-Policy-Report-Only`** allowlisting first-party + Google Analytics. Report-only for now so we can watch the violation log without enforcement risk.
- **Rate limiting** on `POST /api/blends` (10 saves/minute/IP) and `/admin/login` (5 attempts/minute/IP). New `lib/rate-limit.ts` — namespaced in-memory token-bucket; per-instance, swap for Upstash/Redis when scaling beyond one container.
- **Admin login failure logging** — every failed attempt or rate-limit trip emits `[admin-login] failed/rate-limited ip=… ts=…` to stdout. No DB, no PII beyond IP, grep-able from `docker compose logs`.
- **Decoupled admin cookie** (`lib/admin-auth.ts`) — replaces "cookie value IS `ADMIN_SECRET`" with a random 32-byte token + HMAC-SHA256 signature. Cookie compromise no longer reveals the secret. Uses Web Crypto API so it works in both Node (login action) and Edge (proxy/middleware) runtimes. Existing admin sessions invalidate on deploy — re-login once.
- **Tighter URL validation** on Oil admin form — `buyUrl` and `imageUrl` now require `http(s)://`; rejects `javascript:` / `data:` / `vbscript:` URIs that `z.string().url()` accepts by default.
- **`public/robots.txt`** — disallows `/admin/` and `/api/` for well-behaved crawlers.
- **"Abuse prevention" privacy card** on About page — discloses transient in-memory IP processing for rate-limiting (UK/EU GDPR transparency).
- **Homepage stats strip** — live counts of oils (carriers + essentials), curated pairings, community blends, plus the A–F grading callout. Pulled via `Promise.all` of four `prisma.*.count()` calls; the existing "Oils in the Library" feature card now uses dynamic counts too.
- **Admin blend search** — `/admin/blends` now has a search input that filters by id (the cuid), name, or author. Accepts a pasted full URL — strips the prefix to get the bare cuid. Live "showing N of M" counter; `Select all` operates on the filtered set.
- **First-visit hint on `/blend`** — dismissable amber banner above the tab strip explains the four-tab flow. Persists dismissal in localStorage.
- **Footer "Report it on GitHub" link** — channel for class members to report issues without leaving the site.

### Security
- All 7 Dependabot advisories resolved: 2× `fast-uri` (high) via `npm audit fix`; 4× `hono` (medium/low) and `@hono/node-server` (medium) via `overrides` pinning patched versions; 1× `postcss` (medium) via override pinning ≥ 8.5.10. **`npm audit` now reports 0 vulnerabilities.**

### Operational (verification, not code)
- Confirm host crontab hits `/api/cron/purge` daily (auto-purge endpoint already shipped — just needs a wired-up cron entry).
- Confirm reverse proxy (nginx / Cloudflare) returns `301` on `http://` → `https://` so HSTS catches the very first visit too.

## [0.1.19] — 2026-05-09

### Fixed
- **`<BlendBuilder>` now reacts to external draft changes** — removing an oil from the `<BlendCart>` dropdown while on `/blend` no longer leaves the builder's tabs / "In Your Blend" card / Quantities table stale. New listener subscribes to `DRAFT_CHANGE_EVENT` and re-syncs `selectedCarriers` / `selectedEOs` from localStorage when the oil-set membership differs from the builder's own state. Idempotent — auto-saves don't trigger redundant work because the keys match.
- **Compatibility-matrix tooltip is mobile-aware** — was clamped only on the X-axis and used mouse coords, so tapping a dot near the bottom of the viewport pushed the card off-screen with no way to see it. New behaviour:
  - Tooltip is pinned to the cell's bounding rect and clamped to both X and Y; prefers placing the card below the cell, flips above when it would overflow the bottom; horizontally centred over the cell, clamped to viewport edges with an 8 px margin.
  - Tap-to-show on cells (added `onClick` alongside `onMouseEnter`); tap-outside dismisses; close `✕` button on mobile.
  - Auto-dismiss on scroll (capture-phase) and resize so a stale rect can't leave the card floating.
  - `pointer-events-auto` (was `none`) so the card and its close button are interactive on touch.

## [0.1.18] — 2026-05-09

### Changed
- **Compatibility panel renders for any 2+ oils** (was: required at least one carrier *and* one essential oil). Carrier-only blends now score and can be saved (e.g. 50/50 jojoba + sweet almond as a base oil); EO-only combinations score so users can see the rating but cannot be saved.
- **New `lib/blend-rules.ts`** — single source for the gating predicates: `isScorable(c, e)` (≥ 2 oils, any types) and `isSavable(c, e)` (≥ 2 oils with ≥ 1 carrier). Adopted by `<BlendBuilder>`, `<BlendCart>`, and `/api/blends`.
- **`<CompatibilityPanel>` empty-state copy** corrected — was "Add a carrier and at least one essential oil to see compatibility" (misleading; rendered even when oils were present but had no recorded pairings). Now: "No pairing data on record for this combination."
- **`<BlendCart>` dropdown can no longer auto-open** — defensive guard force-closes the panel on the 0 → positive oil-count transition. The dropdown only opens on explicit click.

### Security / Server
- `POST /api/blends` rejects EO-only blends server-side (`Blend must include at least one carrier oil.`) — matches the new client rule.
- Carrier-count check and UNSAFE-pairings query parallelised with `Promise.all` (saves one DB roundtrip per save).

## [0.1.17] — 2026-05-09

### Changed
- **Shared `lib/grade-styles.ts`** — single source for the A/B/C/F badge classes; consumed by both `<BlendCart>` and `<BlendCard>` (replaces two duplicate inline maps).
- **`<BlendCart>` no longer double-fetches pairings on `/blend`** — `usePathname()` skip lets `<BlendBuilder>` remain the source of truth there. Replaced the `lastScoredKey` ref with a derived `useMemo(idsKey)` and dropped the dead `cancelled` flag (the freshKey staleness check already covers it).
- **`BlendDraft.grade` typed as `BlendGrade`** (imported from `lib/blend-scorer.ts`) instead of an inline string union; same change applied in `<BlendCart>` and `<BlendCard>`.
- **`/api/pairings` sets `Cache-Control: private, max-age=60`** — pairings are reference data, safe to cache briefly per-user.
- **Docs catch-up** — `CHANGELOG.md` backfilled for v0.1.11–v0.1.16; `README.md` features table refreshed (tabs, cart persistence, compare tool, drag-to-scroll matrix, glossary); `app/about/page.tsx` features list updated; `docs/DEVELOPMENT.md` and `AGENTS.md` project structure refreshed with `BlendCart`, `NumberStepper`, `lib/blend-storage`, `lib/compare-storage`, `lib/grade-styles`, `lib/use-drag-scroll`.

## [0.1.16] — 2026-05-09

### Added
- **In-progress blend persists across pages** — `lib/blend-storage.ts` (localStorage, schema `v: 2`) keeps the current draft alive while the user navigates to `/oils`, `/oils/[id]`, the compare tool, etc. Restored on `/blend` via auto-hydration; cleared on Reset and on successful save.
- **Header BlendCart widget** — flask icon with two-tone count badge (carriers left, essentials right); click opens a dropdown with per-row remove buttons and the live A–F grade circle. Computes grade in-place (fetches `/api/pairings`) so the badge stays accurate from any page; skips the duplicate fetch on `/blend` where the builder is the source of truth.
- **Compare slot persistence** — `lib/compare-storage.ts` (`v: 2`) keeps the two compare slots alive across navigation; `pushToCompare` returns `'A' | 'B' | 'full' | 'already'` so `<AddToCompareButton>` can show a Replace popover with named slots when both are taken.
- **Compare from oil detail page** — `<AddToCompareButton>` lives next to `<AddToBlendButton>` on `/oils/[id]` (kept off the library cards to avoid clutter).
- **Drag-to-scroll Compatibility Matrix** — `lib/use-drag-scroll.ts` (Pointer Events, skips drag on buttons/links/inputs); `cursor-grab` + `select-none` give the visual cue. Native iOS panning unchanged.
- **Glossary moved to top nav** (was a link from the About page only).

### Changed
- **iOS auto-zoom killed across every input** — `text-base sm:text-sm` baseline in shared `Input.tsx` / `Textarea`, `<NumberStepper>`, `<OilPicker>` search, builder/scaler volume inputs.
- **Right column re-stickied** — `lg:sticky lg:top-20 lg:self-start` (no `max-h`); follows scroll without trapping the cursor.
- **Compare tool**: custom inline-overlay `<SlotSelector>` replaces the shared `<OilPicker>` — fully isolated state per slot (no cross-talk), search dropdown closes on selection.
- `<NumberStepper>` hides native number-input spinners.
- `<QuantityTable>` percentage uses 1-dp + `<1%` threshold to match the Quantities tab (saved-blend page now consistent).
- `<AddToBlendButton>` / `<AddToCompareButton>` drop the transient `Adding…/Added ✓` flash — go straight to the final label after click.

### Fixed
- **Hamburger menu tap target** bumped to `p-3` (44 px); `<ThemeToggle>` to `p-2.5`.
- `<BlendCard>` gains `shadow-sm` to match shared `<Card>`.
- Header restructure: `<BlendCart>` and `<ThemeToggle>` lifted out of `<MobileMenu>` so neither collapses into the hamburger.

### Security
- `POST /api/blends` Zod schema bounds previously unbounded fields: `notes` ≤ 2000, `description` ≤ 500, `purpose` ≤ 200. Save-tab textarea / inputs enforce the same via `maxLength` client-side.
- `/api/cron/purge` `Authorization` comparison made constant-time (matches admin auth).

## [0.1.15] — 2026-05-09

### Changed
- **Reset button moved into the In Your Blend card header** (right-justified next to the title) — real outlined button with hover-red destructive treatment, only shown when at least one oil is selected. Was a wispy text link in the tab strip.

### Fixed
- **Tab strip no longer triggers a flicker vertical scrollbar** on hover. Dropped `overflow-x-auto` from the strip — per CSS spec, when one axis is non-`visible` the other becomes `auto`, which created the spurious vertical scrollbar (and the elastic horizontal "bungy" scroll on mobile). With Reset gone and shorter labels in v0.1.14, the strip fits natively.

## [0.1.14] — 2026-05-09

### Fixed
- **Dilution preset now rescales drops** — clicking 1% / 2% / 3% / 5% used to set `dilutionRate` directly without updating EO percentages, so the displayed `%` column drifted from the preset and the calc was internally inconsistent. New `changeDilution(newRate)` helper rescales EO percentages proportionally; drops derive from percentages so they update in lockstep. Even-distributes when sum is 0; no-ops on the rate alone when no EOs are selected.
- **Tab labels shortened** so the strip fits on tablet/desktop without horizontal scroll. Mobile (`< sm`) uses single words: `Carriers / Essentials / Quantities / Save`. `flex-1` + `whitespace-nowrap` + `overflow-x-auto` as a safety net.
- **Reset button visually distinct from tabs** — italic, smaller, ↺ icon, hover-red.
- **In Your Blend card** is now a vertical list (one oil per row) with hover state and per-row ✕ button, instead of a comma-joined inline list. Reuses `removeCarrier` / `removeEO` so cleanup logic (e.g. clearing `avoidAcknowledged`) runs.

## [0.1.13] — 2026-05-09

### Changed
- **Tabs replace the accordion** in the blend builder — four tabs in the left column: `1. Carrier Oils` / `2. Essential Oils` / `3. Quantities` / `4. Save Blend`. Tabs 1 and 2 carry a count badge. Both columns sticky on desktop.
- **`<OilPicker>` is body-only** — card shell, accordion header, chevron, and `isOpen` / `onOpen` / `title` props all removed. Tab content provides its own h2 + subtitle above the picker.

### Added
- **Merged editable Quantities table** — Carrier table (`Oil | ml stepper | ratio % | ✕`) and EO table (`Oil | drops stepper | ml | % | ✕`) each with a Total row (red on overflow / amber on under for carriers; red on over-max-dilution for EOs). Replaces the old `<SelectedIngredientRow>` + read-only `<QuantityTable>`.
- **`<NumberStepper>` component** — `[−] [N] [+]` widget with 36 px touch targets, `U+2212` minus, disabled state at min/max, optional `over` red palette. Used for both ml (carrier) and drops (EO).
- **`<SelectedOilsCard>`** — "In Your Blend" summary card at the top of the right column; comma-separated names per oil type (later changed to a vertical list in v0.1.14).
- **Save Blend moved to Tab 4** (with the read-only `<QuantityTable>` summary above name/notes/save).

### Removed
- `components/blend/SelectedIngredientRow.tsx` — replaced by inline table cells in the merged Quantities table.

## [0.1.12] — 2026-05-08

### Changed
- **Layout restructure** — merged the right-column "Your Blend" card into the left-column Quantities card so editable controls and read-only summary live together. Right column now hosts Compatibility (alerts at top, then grade panel) and a dedicated Save Blend card.
- **Selected-oil colour neutral** — `<OilPicker>` browse-mode selected card uses amber border + neutral background (was `bg-amber-50` / `dark:bg-amber-950` — read as the same orange-red as the grade-B badge in dark mode). Search-dropdown selected uses stone bg.

### Added
- **Per-oil dilution warnings rendered in two places** — top of the Compatibility card and inside the Quantities card. `CalculatedIngredient.overMaxDilution` flag lets `<SelectedIngredientRow>` switch to red-bordered styling and `<QuantityTable>` highlight the offending row in red.

## [0.1.11] — 2026-05-08

### Added
- **App version displayed under the About-page heading**, linked to the GitHub release for that tag (reads `pkg.version` directly from `package.json`).

### Changed
- **Homepage**: new "Multi-Carrier Blending" feature card; updated "Precise Quantities" copy to describe the additive carrier model.
- **Features list on About** updated with multi-carrier, additive model, glossary, and max-dilution warnings.

### Tooling
- `/ship` slash command bumps `package.json` to match the new tag before tagging, so the About page version always matches the deployed release.

## [0.1.10] — 2026-05-08

### Changed
- **Unified oil picker** — Sections 1 and 2 in the blend builder now share a single `<OilPicker>` component (`components/blend/OilPicker.tsx`). Identical interaction model: selected oils stay visible in the picker with an amber highlight + ✓ marker; clicking a selected card removes it (highlight-toggle). Previously EOs vanished from the picker on add — this asymmetry is gone.
- **Carrier cap of 5** — `MAX_CARRIERS = 5`, matching `MAX_EOS`. When at the cap, unselected cards are disabled with a "deselect one to add another" hint; selected cards remain interactive so users can remove from the picker.
- **EO % / drops toggle removed** — drops is now the only display mode. Removed the iOS-style sliding toggle; deleted the `eoInputMode` state, the percent input branch, the `updatePct` and `normalizePercentages` helpers, and the "Percentages don't sum" warning button. Per-EO safety warning (calculator's `dilutionRateMax` check) still fires.
- **Consistent right-column labels** — `Carrier Oils (X/5)` and `Essential Oils (X/5)` use the same `(N/5)` format; `MAX_CARRIERS` / `MAX_EOS` constants substituted for literal `5`.
- **Aligned section titles** — `1. Choose Your Carrier Oils` and `2. Choose Your Essential Oils` (was "Add Essential Oils").
- **Aligned right-column row styling** — EO entries now use the same amber-bordered card as carriers; `<SelectedIngredientRow>` shared component.
- **`DROPS_PER_ML` exported** from `lib/blend-calculator.ts` along with new `pctToDrops` and `dropsToPct` helpers; eliminates four hardcoded `20`s and the inverse drops↔percentage math repetition.
- **`MIN_DILUTION_RATE = 0.001` + `dilutionFromEOs(eos)` helper** in `BlendBuilder` — fixes a floor-asymmetry where `addEO` lacked the 0.1% minimum that `removeEO`/`updateDrops` enforced.
- **BlendScaler** — Volume preset buttons match the builder's touch-friendly sizing (`px-3 py-2 text-sm`); preset list extended to include `200 ml`.

## [0.1.9] — 2026-05-08

### Fixed
- **Carrier ml-based input** — replaces the previous percentage-based input. Each carrier shows ml directly. Eliminates the `100 / 3 = 33.333%` rounding bug where the input displayed `33%` but the QuantityTable showed `34%` (calculator's `sumCarrierPct` renormalisation drift), and the "should sum to 100%" warning would never clear when editing one carrier and back.
- `lib/blend-calculator.ts` — `IngredientInput.volumeMl?: number` added; carrier branch uses it directly. `BlendCalculation.carrierVolumeMl` is now the actual sum of carrier ml (so drift is visible). The `sumCarrierPct` renormalisation is gone — calculator output and right-column input always agree.
- **Drift warning + Fit to Volume** — when carrier sum drifts more than 0.5 ml from the chosen Volume, an inline hint shows `X ml over Volume` or `X ml unallocated` with a one-click **Fit to Volume** button that scales all carriers proportionally back to the target.
- **Volume change scales carriers** — clicking a Volume preset or entering a custom volume rescales existing carriers proportionally (preserves ratios).
- **`<QuantityTable>` consistency** — carrier rows show `—` in the `%` column (percentage no longer the user's mental model for carriers); footer total ml = real sum of `volumeMl` (was hardcoded `100%`).
- **Page loader** — `app/blend/page.tsx` passes saved `BlendIngredient.volumeMl` straight through; dropped the percentage-normalisation block.
- **BlendScaler** — accepts optional `volumeMl` per carrier ingredient and scales it by `viewVolumeMl / originalVolumeMl`; detail page passes through the carrier ml.

## [0.1.8] — 2026-05-08

### Added
- **Multi-carrier blends** — pick more than one carrier oil per blend (e.g. 50 ml jojoba + 50 ml sweet almond). Default split is even (1 → 100%, 2 → 50/50, 3 → 33/33/33); adjustable per carrier.
- **Additive carrier model** — replaces the previous "carrier reduces by EO volume" model. The chosen Volume is the carrier volume target; essential oils add on top. A 100 ml blend at 3% dilution is now 100 ml carrier + 3 ml EO = 103 ml final. Matches standard aromatherapy practice.
- **"Final mix: X ml" hint** under the Volume row showing `carrier + essentials` total.
- **"Next →" button** on Section 1 — replaces the auto-advance to Section 2 that fired on first carrier selection. Lets users curate their full carrier list before moving on.
- `BlendCalculation.finalVolumeMl` field exposed by `lib/blend-calculator.ts`.
- **Confirmed (no code change)**: carrier↔carrier and carrier↔EO pairings already feed `scoreBlend` equally — `fetchPairings` sends every selected ID, `scoreBlend` weights all ratings the same regardless of oil type. Multi-carriers contribute to the rating.

### Changed
- `BlendBuilder` `selectedCarriers` is now an array of `{ oil, percentagePct }` (later changed to `{ oil, volumeMl }` in v0.1.9). `addCarrier` / `removeCarrier` / `updateCarrierPct` mirror the existing EO helpers.
- Section 1 picker uses the same 2-column grid + card layout as Section 2 (was 3-column with a different card style); cards toggle add/remove with selected highlight.
- Page loader normalises carrier percentages so old (single-carrier ~97%) and new (50/50) saved blends both initialise correctly.

## [0.1.7] — 2026-05-07

### Added
- **Accordion sections** in the blend builder — Sections 1 and 2 are independently collapsible. Selecting a carrier auto-collapses Section 1 and opens Section 2.
- **Search/Browse mode for the carrier picker** — matches the EO picker's existing toggle; carrier picker now uses the same 2-column card layout as EOs.
- **iOS-style sliding toggle** for the EO `% / drops` input mode (later removed in v0.1.10 in favour of drops-only).

### Changed
- Touch-friendly improvements across the blend builder: bigger Volume / Dilution preset buttons (`py-2` → `py-2 px-3 text-sm`), enlarged ✕ remove buttons (`p-1.5 rounded-full` ~32 px tap target), `py-1.5` height on EO percentage / drops inputs.
- Removed the per-card ⓘ info toggle on carrier and EO browse cards.

## [0.1.6] — 2026-05-07

### Added
- **AI Quick-Add for oils** — `/admin/oils/new` accepts just oil name + type and uses Claude to generate the full profile for review before saving. Only shown when `ANTHROPIC_API_KEY` is set.
- **Manual add fallback** — `/admin/oils/new/manual` always available; admin landing page now shows two buttons: `+ Add with AI` (when key set) and `+ Add Manually` (always).
- **Mobile oil-info toggle** — ⓘ button on carrier and browse-mode EO cards expands description, benefits, and properties inline (later removed in v0.1.7 along with the accordion refactor).

## [0.1.5] — 2026-05-07

### Added
- **Aromatherapy glossary** at `/about/glossary` — 42 terms across Therapeutic Properties, Carrier Oil Properties, Fatty Acids & Chemistry, and Blending & Safety. Linked from the About page.
- **Drops input mode** for essential oils — toggle in the right column switches the per-EO input between percentage and drop-count. Updating drops back-calculates dilution rate.
- **Display rounding** — QuantityTable `%` column rounds to whole numbers (`<1%` for tiny EO values), `ml` column drops to 1 dp; "1 ml ≈ 20 drops" footer note.
- **/ship slash command** — automates commit → tag → push workflow; later updated to use `gh run watch` for pipeline monitoring.

## [0.1.4] — 2026-05-04

### Fixed
- Compatibility matrix sticky column bleed-through (proper fix this time).

## [0.1.3] — 2026-05-04

### Fixed
- Essential oil percentage normalization on add/remove.
- Blend expiry note wording on saved-blend pages.
- Compatibility matrix sticky column bleed-through (first attempt).

## [0.1.2] — 2026-05-04

### Added
- **Hide premature blend grade** — the `<CompatibilityPanel>` no longer renders an "A — Excellent Blend" badge before any oil is selected (`hasBlend` guard).
- **Reset button** — clears all blend builder state in one click; visible only when something is selected.
- **"Build from this blend"** — link on saved-blend detail pages that pre-populates the builder with the same carrier, EOs, volume, and dilution. Uses a `?from=<id>` URL param.
- **Volume scaler on saved-blend detail page** — `<BlendScaler>` lets the user adjust the view volume; all displayed quantities recalculate proportionally without mutating the saved blend.

## [0.1.1] — 2026-05-04

### Added
- Admin oil search.
- CI bumped to Node 24.

### Fixed
- Clear enrichment backfill so re-enriching is genuinely idempotent.

## [0.1.0] — 2026-05-06

### Added
- **Oil Compare tool** (`/oils/compare`) — side-by-side comparison of any two oils: full profiles on each side, compatibility verdict in the centre column with a coloured rating dot and reason text; swap button (⇄); searchable combobox selectors
- **"Compare" nav link** added to the main header (desktop and mobile)
- **Compatibility matrix row/column highlighting** — click any column header to highlight that column; click any row label to highlight the row; intersection cell gets a stronger tint to pinpoint the exact pairing
- **Compatibility matrix axis search** — independent search inputs filter which oils appear on the row axis and column axis; Reset button clears all filters and highlights
- **Blend notes** — optional freeform notes textarea on the blend save form; displayed as a sidebar card on the blend detail page and printed in the PDF recipe card
- **Author and about on blend detail and PDF** — `authorName` shown as "by …" under the blend title; `about` shown as the blend description (takes precedence over `description`); both printed in the PDF header
- **Mobile hamburger navigation** — responsive hamburger menu for screens narrower than `md` (768 px); outside-click or link navigation closes the menu; ThemeToggle included in the mobile bar
- **PWA support** — web app manifest (`/manifest.json`), generated favicons at 32 × 32 and 180 × 180 px, `standalone` display mode, `appleWebApp` metadata; "Add to Home Screen" installation guide added to the About page
- **Dark mode FOUC prevention** — synchronous inline `<script>` in `<head>` reads `localStorage` and applies the `dark` class before first paint; `suppressHydrationWarning` on `<html>` suppresses the inevitable React mismatch
- **Per-oil enrichment tracking** — `enrichedAt` (timestamp) and `enrichmentModel` (string) fields added to the `Oil` schema; stamped on every successful enrichment (bulk and per-oil); a migration backfills existing rows so re-running enrichment on a live instance is a no-op
- **Bulk enrichment skips already-enriched oils by default** — only unenriched oils are processed; set `FORCE_REENRICH=1` in the environment to override and re-enrich all; see [Enriching Oil Data](README.md#enriching-oil-data)
- **Migration management UI** — new Migrations card at the top of `/admin/database` shows which migrations are applied/pending, renders a SQL preview for each pending migration, provides a one-click **Apply Pending Migrations** button, and includes collapsible manual shell instructions (restart container / exec migrate.js / raw SQL)
- **"Unenriched" badge** on admin oil list — amber chip shown on any row where `enrichedAt` is null
- **Enrichment status caption** on per-oil edit page — "Enriched N days ago, model" or "Not enriched yet" shown next to the Enrich button

### Changed
- **Enrich button is now tri-state** — `Enrich N oil(s)` (active), `All oils enriched` (disabled), or `Starting…` (pending); a **Force re-enrich all** secondary action appears when all oils are already enriched
- **iOS input auto-zoom fix** — inputs on Oil Compare and Compatibility Matrix use `text-base` (16 px) on mobile to prevent Safari's auto-zoom on focus
- Compatibility matrix Quick Compare panel removed and replaced by the dedicated `/oils/compare` page

## [0.0.13] — 2026-05-05

### Fixed
- Container seed/enrich scripts failed with `Cannot find module 'postgres-array'` — copy the full `pg` transitive dependency tree into the runner image (`pg-protocol`, `pg-types`, `pg-connection-string`, `pg-int8`, `pg-cloudflare`, `pgpass`, `postgres-array`, `postgres-bytea`, `postgres-date`, `postgres-interval`)
- `ANTHROPIC_API_KEY` not forwarded to the app container in `docker-compose.yml`; the Enrich button in the admin panel now works when the key is set in the host environment or `.env`
- `docker-compose.yml`: removed host port binding on the postgres service (database is internal-only); added explicit `backend` bridge network so the two containers communicate without exposing the database port to the host

## [0.0.12] — 2026-05-04

### Added
- **Admin Database panel** at `/admin/database` — seed the database or run AI enrichment directly from the browser without SSH or CLI access
- Seed action runs synchronously and reports oils/pairings upserted; enrichment spawns as a background process (takes several minutes — check server logs)
- Enrich button is only shown when `ANTHROPIC_API_KEY` is set on the server; shows a disabled state with instructions otherwise
- Live stats card showing current oil, pairing, and blend counts
- Database nav link added to Oils and Blends admin pages

### Changed
- README: added CI/CD pipeline status badge; specific version pinned in Docker pull example replaced with a link to Releases page

## [0.0.11] — 2026-05-04

### Added
- `scripts/enrich.js` bundled into Docker image (compiled from `scripts/enrich-oils.ts` via esbuild) so the enrichment pipeline can run inside the container: `docker compose exec -e ANTHROPIC_API_KEY=... app node scripts/enrich.js`
- `docs/DEVELOPMENT.md` — dedicated local development guide covering setup, schema changes, enrichment pipeline, project structure, and release process

### Changed
- Default `NEXT_PUBLIC_SITE_NAME` changed from `Potions & Lotions` to `Oil Blender`
- README rewritten as a deployment/operations guide (Docker quickstart, env vars, admin, auto-purge, enrichment); development content moved to `docs/DEVELOPMENT.md`
- All references to "Potions & Lotions" updated to "Oil Blender" throughout README, About page, and env defaults

## [0.0.10] — 2026-05-04

### Added
- Seed script compiled to `scripts/seed.js` during Docker build so the database can be seeded from inside the container without cloning the repo or installing tsx: `docker compose exec app node scripts/seed.js`

### Fixed
- README Getting Started: added missing `npx prisma generate` step after `npm install` (omitting it causes `Cannot find module '.prisma/client/default'` when running seed or enrich)
- README Docker section: corrected container seed command from `npx tsx scripts/seed.ts` (tsx not available in runner) to `node scripts/seed.js`

## [0.0.9] — 2026-05-04

### Added
- **`NEXT_PUBLIC_SITE_NAME`** env var — sets the deployment display name shown in the header, footer, page titles, and PDF; defaults to `"Potions & Lotions"`; About page shows a "Powered by Potions & Lotions" attribution when a custom name is set

### Fixed
- `ADMIN_SECRET` and `CRON_SECRET` were not forwarded to the app container in `docker-compose.yml`, causing the admin panel to be accessible without a password
- `NEXT_PUBLIC_SITE_NAME` added to `docker-compose.yml` environment block
- Renamed `package.json` package name from `oils` to `oil-blender` (eliminates grype false positive GHSA-v279-v2xm-whq9)
- Dockerfile runner stage now runs `apk upgrade` to pick up patched BusyBox (CVE-2025-60876)
- Renamed `middleware.ts` → `proxy.ts` and exported function `middleware` → `proxy` (Next.js 16 deprecation)
- Added `data-scroll-behavior="smooth"` to `<html>` element (Next.js 16 scroll behaviour change)

## [0.0.8] — 2026-05-04

### Changed
- Repository renamed from `oils` to `oil-blender` (`github.com/tfindley/oil-blender`)
- All internal references, Docker image paths, documentation, and About page links updated to match

## [0.0.7] — 2026-05-04

### Added
- **Google Analytics 4** — optional analytics via `NEXT_PUBLIC_GA_MEASUREMENT_ID` env var; omit to disable entirely; no tracking code injected when unset
- **View tracking** — every blend page visit increments `viewCount` and updates `lastAccessedAt` (fire-and-forget, does not slow page load)
- **Auto-purge endpoint** — `GET /api/cron/purge` (authenticated with `CRON_SECRET`) deletes non-featured blends inactive for 30+ days; host-side cron setup documented in README
- **Admin blend management** — `/admin/blends` lists all blends with view count, grade, last accessed date, and feature flags; supports single, multi-select, and all-non-featured bulk delete
- **Admin blend edit** — `/admin/blends/[id]` allows editing author name, about text, and isFeatured / isPinned / isHidden flags; shows read-only ingredient list and stats
- **Admin blend promote flow** — `/admin/blends/import` accepts a blend URL or bare ID, shows a preview, and saves author metadata and feature flags to promote a user-built blend to the curated showcase
- **Featured blends on homepage** — pinned and featured blends shown in a `BlendCard` grid between the hero and the feature grid; section hidden when no featured blends exist
- **Public `/blends` listing page** — shows all non-hidden featured and popular (≥ 5 views) blends, sorted pinned → featured → viewCount
- **`BlendCard` component** — public-facing card with grade badge, author byline, about excerpt, top 3 essential oils, view count, and pin indicator
- **"Blends" nav link** added to the header (between Build a Blend and Oil Library)
- **Privacy & analytics disclosures** on the About page — explains what blend data is stored, the 30-day auto-purge policy, and how Google Analytics is used with opt-out instructions
- **10 additional carrier oils** — Walnut, St John's Wort, Wheat Germ, Comfrey, Neem, Macadamia, Calendula, Borage Seed, Arnica, Olive; 37 new pairings seeded (library now 55 oils, 96+ pairings)
- **`.env.example`** — documents all required and optional environment variables
- **PDF QR code** — blend share URL embedded as a QR code image in the downloadable recipe card

### Changed
- Blend schema extended with 7 new fields: `viewCount`, `lastAccessedAt`, `authorName`, `about`, `isFeatured`, `isPinned`, `isHidden`
- `BlendDetail` TypeScript type updated with the 7 new fields
- Homepage is now a dynamic server component fetching featured blends from the database
- Feature grid on homepage updated: oil count corrected to 55, PDF description updated to mention QR code

## [0.0.5] — 2026-05-04

### Added
- Dark mode with system-preference detection and manual toggle (persisted in localStorage)
- Admin panel at `/admin` — list, create, edit, and delete oils without touching the database directly
- Oil images: `imageUrl` + `imageAlt` fields on the Oil model; displayed as hero on detail pages and thumbnail on cards
- Buy/sponsor links: optional `buyUrl` per oil renders a "Buy this oil" button on the detail page
- Botanical names shown on oil cards and searchable alongside common names
- Search reset ("Clear") button on the Oil Library page
- Replaced developer-facing "run npm run enrich" empty-state message with a user-friendly alternative

### Changed
- Oil Library search now matches against both common name and botanical name
- `OilSummary` type now includes `botanicalName`, `imageUrl`, `imageAlt`, and `buyUrl`

### Fixed
- Empty search state now offers a "clear filter" link instead of referencing a CLI command

## [0.0.4] — 2026-05-04

### Fixed
- Container startup failure: replaced Prisma CLI migration runner (which required a large transitive dep tree not present in the lean runner image) with a lightweight `scripts/migrate.js` that uses only the `pg` package already bundled in the image

## [0.0.3] — 2026-05-04

### Added
- `docker-compose.yml` now includes the `app` service pulling `ghcr.io/tfindley/oil-blender:latest`, with a postgres healthcheck dependency
- `docker-compose.build.yml` override file for building the image locally
- `docker-compose.external-db.yml` for running against an existing database (reads from `.env.local`)
- `docker-entrypoint.sh` runs database migrations automatically on container startup before starting the server
- Prisma CLI + config copied into runner image to support the startup migration step

## [0.0.2] — 2026-05-04

### Fixed
- Docker image build failure: `/blend`, `/blend/[id]`, `/oils`, and `/oils/[id]` pages were being statically pre-rendered at build time, causing a database connection error (`ECONNREFUSED`) since no database is available in the build environment. Added `export const dynamic = 'force-dynamic'` to each page.

## [0.0.1] — 2026-05-01

### Added
- Initial application: blend builder, oil library, saved blend pages
- 45 oils seeded (15 carriers, 30 essential oils) with full profiles, benefits, and contraindications
- 62 curated oil pairings with EXCELLENT / GOOD / CAUTION / AVOID / UNSAFE ratings
- 5 hard-blocked UNSAFE combinations
- A–F blend compatibility scoring
- Blend quantity calculator (ml + drops per oil)
- Shareable blend URLs (`/blend/[id]`)
- PDF recipe card download (client-side, via `@react-pdf/renderer`)
- About page with AI/LLM transparency, tech stack, GitHub, Ko-Fi links
- Multi-stage Dockerfile with standalone Next.js output
- GitHub Actions CI/CD: builds and pushes Docker image to `ghcr.io/tfindley/oil-blender` on `v*.*.*` tag push, creates GitHub Release
- Oil enrichment pipeline (`npm run enrich`) using Claude API for richer AI-generated profiles

[Unreleased]: https://github.com/tfindley/oil-blender/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/tfindley/oil-blender/compare/v0.2.4...v1.0.0
[0.2.4]: https://github.com/tfindley/oil-blender/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/tfindley/oil-blender/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/tfindley/oil-blender/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/tfindley/oil-blender/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/tfindley/oil-blender/compare/v0.1.19...v0.2.0
[0.1.19]: https://github.com/tfindley/oil-blender/compare/v0.1.18...v0.1.19
[0.1.18]: https://github.com/tfindley/oil-blender/compare/v0.1.17...v0.1.18
[0.1.17]: https://github.com/tfindley/oil-blender/compare/v0.1.16...v0.1.17
[0.1.16]: https://github.com/tfindley/oil-blender/compare/v0.1.15...v0.1.16
[0.1.15]: https://github.com/tfindley/oil-blender/compare/v0.1.14...v0.1.15
[0.1.14]: https://github.com/tfindley/oil-blender/compare/v0.1.13...v0.1.14
[0.1.13]: https://github.com/tfindley/oil-blender/compare/v0.1.12...v0.1.13
[0.1.12]: https://github.com/tfindley/oil-blender/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/tfindley/oil-blender/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/tfindley/oil-blender/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/tfindley/oil-blender/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/tfindley/oil-blender/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/tfindley/oil-blender/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/tfindley/oil-blender/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/tfindley/oil-blender/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/tfindley/oil-blender/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/tfindley/oil-blender/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/tfindley/oil-blender/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/tfindley/oil-blender/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/tfindley/oil-blender/compare/v0.0.13...v0.1.0
[0.0.13]: https://github.com/tfindley/oil-blender/compare/v0.0.12...v0.0.13
[0.0.12]: https://github.com/tfindley/oil-blender/compare/v0.0.11...v0.0.12
[0.0.11]: https://github.com/tfindley/oil-blender/compare/v0.0.10...v0.0.11
[0.0.10]: https://github.com/tfindley/oil-blender/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/tfindley/oil-blender/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/tfindley/oil-blender/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/tfindley/oil-blender/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/tfindley/oil-blender/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/tfindley/oil-blender/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/tfindley/oil-blender/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/tfindley/oil-blender/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/tfindley/oil-blender/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/tfindley/oil-blender/releases/tag/v0.0.1
