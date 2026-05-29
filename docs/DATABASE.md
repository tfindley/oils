# Database

Oil Blender uses **PostgreSQL** managed through **Prisma ORM** (`@prisma/adapter-pg` with a raw `pg` connection pool). The schema lives in [`prisma/schema.prisma`](../prisma/schema.prisma) and migrations are plain SQL files in [`prisma/migrations/`](../prisma/migrations/).

---

## Entity Overview

```
Oil ──< OilPairing >── Oil
 │
 └──< BlendIngredient >── Blend ──> User (optional — anonymous blends have userId = null)
                                    │
                                    ├──< Session
                                    ├──< Account
                                    └──< VerificationToken (by email)

Settings (singleton row)
```

| Table | Rows (seeded) | Purpose |
|-------|--------------|---------|
| `Oil` | ~55 | Master oil library — essential and carrier oils |
| `OilPairing` | ~800+ | Compatibility ratings between any two oils |
| `Blend` | varies | Blends — anonymous (no userId) or user-owned |
| `BlendIngredient` | varies | Line items linking a Blend to its Oils |
| `User` | varies | User accounts (v1.1.0+); email + password or future OAuth |
| `Session` | varies | Auth.js v5 session table (kept for OAuth in v2; JWT strategy is current) |
| `Account` | varies | OAuth provider links (placeholder until v2 OAuth) |
| `VerificationToken` | varies | Email verification + password reset tokens |
| `Settings` | 1 | Site-wide toggles (singleton row, `id="singleton"`) |

---

## Models

### `Oil`

The master record for every oil in the library. Each oil is either an **essential oil** or a **carrier oil** — the type drives which fields are populated and how the blend calculator applies it.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` (cuid) | Primary key |
| `name` | `TEXT UNIQUE` | Common English name, e.g. `"Lavender"` |
| `botanicalName` | `TEXT` | Latin name, e.g. `"Lavandula angustifolia"` |
| `type` | `OilType` enum | `ESSENTIAL` or `CARRIER` |
| `origin` | `TEXT` | Primary country/region of origin |
| `history` | `TEXT` | 2–3 sentences of historical context |
| `description` | `TEXT` | Character, texture, and massage applications |
| `benefits` | `TEXT[]` | Array of 4–6 benefit strings |
| `contraindications` | `TEXT[]` | Array of cautions/warnings (may be empty) |
| `aroma` | `TEXT` | Brief aroma description |
| `consistency` | `TEXT?` | Carrier only: `light`, `medium`, or `heavy` |
| `absorbency` | `TEXT?` | Carrier only: `fast`, `medium`, or `slow` |
| `shelfLifeMonths` | `INT?` | Carrier only: typical shelf life in months |
| `dilutionRateMax` | `FLOAT?` | Essential only: max safe dilution (e.g. `0.02` = 2%) |
| `buyUrl` | `TEXT?` | Optional affiliate/purchase link |
| `imageUrl` | `TEXT?` | Optional hero image URL |
| `imageAlt` | `TEXT?` | Alt text for the image |
| `enrichedAt` | `TIMESTAMP?` | Set when the oil is enriched via the Claude API; null means never enriched |
| `enrichmentModel` | `TEXT?` | Model ID used for the last enrichment, e.g. `claude-sonnet-4-6` |
| `createdAt` / `updatedAt` | `TIMESTAMP` | Managed by Prisma |

**Relations:**
- `pairsWithA` / `pairsWithB` — two sides of the `OilPairing` join (see below)
- `blendIngredients` — all `BlendIngredient` rows that reference this oil

---

### `OilPairing`

Records the compatibility verdict between two specific oils. Pairings are **bidirectional but stored once** — the lower cuid always goes in `oilAId` and the higher in `oilBId` (sorted lexicographically before every write). This is enforced by the `@@unique([oilAId, oilBId])` constraint and the `pairingKey()` helper in [`lib/pairing-utils.ts`](../lib/pairing-utils.ts).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` (cuid) | Primary key |
| `oilAId` | `TEXT` | FK → `Oil.id` (sorted lower of the two IDs) |
| `oilBId` | `TEXT` | FK → `Oil.id` (sorted higher of the two IDs) |
| `rating` | `PairingRating` enum | See rating table below |
| `reason` | `TEXT` | One-sentence explanation shown to the user |

**Cascade:** deleting either referenced oil cascades to delete all its pairings.

**Lookup pattern:** to find the pairing for oils `x` and `y`, always call `pairingKey(x, y)` which returns `min:max` — then do a single map lookup. Never query with `oilAId=x AND oilBId=y`; it will miss half the cases.

#### `PairingRating` enum

| Value | Meaning | Shown to user as |
|-------|---------|-----------------|
| `EXCELLENT` | Actively beneficial together, enhances effects | Excellent |
| `GOOD` | Compatible, no issues | Compatible |
| `CAUTION` | Mild concern (competing scents, mild sensitisation risk) | Caution |
| `AVOID` | Not recommended (therapeutic conflict, sensitisation, aroma clash) | Avoid |
| `UNSAFE` | Hand-curated safety override — must not be combined | Unsafe |

`UNSAFE` is never emitted by AI enrichment; it is only applied by the hand-curated list in [`scripts/unsafe-pairs.ts`](../scripts/unsafe-pairs.ts).

---

### `Blend`

A blend formula. Two ownership modes:

- **Anonymous** (`userId = null`) — created by a signed-out visitor. Public by URL forever; subject to the 30-day inactivity purge unless an admin marks it featured/pinned.
- **Owned** (`userId` set) — created by a signed-in user. Default-private (`isShared = false`); the owner toggles share state from the detail page. Persists for the lifetime of the user account; on user delete, the FK cascade sets `userId = null` (the blend becomes anonymous, URL keeps working).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` (cuid) | Primary key, used in the share URL `/blend/:id` |
| `userId` | `TEXT?` | FK → `User.id`; `null` for anonymous blends; ON DELETE SET NULL |
| `isShared` | `BOOLEAN` | Owner's publish toggle. Anonymous blends ignore this — always public by URL. Owned blends default `false`. |
| `name` | `TEXT` | User-supplied blend name |
| `description` | `TEXT?` | Optional free-text description |
| `about` | `TEXT?` | Admin-added editorial description (takes precedence over `description` on the detail page) |
| `authorName` | `TEXT?` | Legacy display name (anonymous + admin-promoted blends). For owned blends, the source-of-truth is `user.name`. |
| `totalVolumeMl` | `FLOAT` | Total volume of the finished blend in ml |
| `dilutionRate` | `FLOAT` | Overall dilution ratio, e.g. `0.02` = 2% |
| `purpose` | `TEXT?` | Optional intended use (relaxation, pain relief, etc.) |
| `notes` | `TEXT?` | User's own freeform notes |
| `grade` | `TEXT` | Compatibility grade: `A`, `B`, `C`, or `F` (stored as string, not enum) |
| `viewCount` | `INT` | Incremented fire-and-forget on every detail page view |
| `lastAccessedAt` | `TIMESTAMP?` | Updated on every detail page view |
| `isFeatured` | `BOOLEAN` | Admin flag — shown in the public featured blends section |
| `isPinned` | `BOOLEAN` | Admin flag — always appears first in listings |
| `isHidden` | `BOOLEAN` | Admin flag — excluded from all public listings |
| `createdAt` / `updatedAt` | `TIMESTAMP` | Managed by Prisma |

**Grade** is computed by the blend builder at save time based on the worst pairing rating across all ingredient combinations:
- `A` — all pairings EXCELLENT or GOOD
- `B` — worst is CAUTION
- `C` — worst is AVOID
- `F` — any UNSAFE pairing present

**Access control** (matches `app/blend/[id]/page.tsx` and `GET /api/blends/[id]`):
- Anonymous (`userId === null`) → public by URL.
- Owned + `isShared === true` → public by URL.
- Owned + `isShared === false` + viewer is the owner → owner can view.
- Owned + `isShared === false` + non-owner → **404** (no existence leak).

**Public listings** (`/blends`, homepage featured grid): always filter `OR: [userId: null, isShared: true]` regardless of featured/pinned flags — owned-private blends never appear in public listings even if the admin features them.

**Auto-purge:** `/api/cron/purge` deletes non-featured, non-pinned blends whose `lastAccessedAt` (or `createdAt`) is older than 30 days **AND whose `userId IS NULL`**. Owned blends are exempt for the lifetime of the account.

---

### `BlendIngredient`

Join table between `Blend` and `Oil`, carrying the computed quantity data for each oil in the formula.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` (cuid) | Primary key |
| `blendId` | `TEXT` | FK → `Blend.id` |
| `oilId` | `TEXT` | FK → `Oil.id` |
| `percentagePct` | `FLOAT` | Percentage of this oil in the blend (0–100) |
| `volumeMl` | `FLOAT` | Absolute volume in ml |

**Cascade:** deleting a blend cascades to delete all its ingredients.  
**Restrict:** deleting an oil is blocked if it exists in any `BlendIngredient` row — you must remove the ingredient references first.

`@@unique([blendId, oilId])` — an oil can appear at most once per blend.

---

### `UserOilCollection`

Per-user oil inventory (v1.4.0+). A row represents the user "owns" an oil, optionally with quantity / opened date / expiry / supplier metadata.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` (cuid) | Primary key |
| `userId` | `TEXT` | FK → `User.id`; ON DELETE CASCADE |
| `oilId` | `TEXT` | FK → `Oil.id`; ON DELETE RESTRICT (an oil can't be deleted while any user owns it) |
| `quantity` | `FLOAT?` | Remaining volume in ml; optional |
| `openedAt` | `TIMESTAMP?` | When the bottle was opened — drives derived expiry when combined with `Oil.shelfLifeMonths` (carriers) |
| `expiresAt` | `TIMESTAMP?` | Explicit best-before; overrides the derived value |
| `supplier` | `TEXT?` | Freeform supplier / vendor name |
| `cost` | `FLOAT?` | Purchase price for the bottle as bought, in `User.currency`. |
| `bottleSizeMl` | `FLOAT?` | Size of the bottle the `cost` applies to. Gives cost a real unit ("€12.50 for 30 ml"). Optional — without it cost on its own is informational only. Future cost-per-blend computations need both. |
| `batchNo` | `TEXT?` | Manufacturer batch / lot number |
| `notes` | `TEXT?` | Freeform notes |
| `addedAt` / `updatedAt` | `TIMESTAMP` | Managed by Prisma |

`@@unique([userId, oilId])` — a user can have an oil in their collection at most once.
`@@index([userId])` for `/my-collection` listings.

**Drives:**
- `/my-collection` page (lists + per-row inline edit)
- "From my collection" filter chip in the blend builder's oil picker
- Shopping list on `/blend/[id]` (which of the recipe's oils you don't own yet, with `Oil.buyUrl` links)

**Effective expiry**: explicit `expiresAt` wins; else derived from `openedAt + Oil.shelfLifeMonths` (carriers); else null. Anything within 30 days of expiry shows an amber warning badge; past-expiry shows red.

---

### `User`

User accounts introduced in v1.1.0. Used by the email+password Credentials provider; in v2 will also be the target of OAuth `Account` rows.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` (cuid) | Primary key |
| `email` | `TEXT UNIQUE` | Lowercased before write (`signupAction` normalises) |
| `emailVerified` | `TIMESTAMP?` | Set on successful verification link click; also set by password reset (proves inbox access) |
| `passwordHash` | `TEXT?` | argon2id via `@node-rs/argon2`. Nullable so future OAuth-only accounts work without a password. |
| `firstName` | `TEXT` | Required at signup; 1–50 chars, no leading/trailing whitespace; NOT NULL DEFAULT `''` so the migration is safe on existing dev rows |
| `lastName` | `TEXT` | Same constraints as `firstName` |
| `name` | `TEXT?` | Display name — what shows on saved blends as "by …". User picks how it's formatted (`First Last`, `Last, First`, `First L.`, `F. Last`, `Anonymous`, or Custom). |
| `image` | `TEXT?` | Avatar URL — set by OAuth providers in v2 |
| `role` | `UserRole` enum | `USER` or `ADMIN`. Drives `/admin/*` access alongside the legacy cookie path. |
| `createdAt` / `updatedAt` | `TIMESTAMP` | Managed by Prisma |
| `lastSignInAt` | `TIMESTAMP?` | Stamped in `auth.ts`'s JWT callback on every successful sign-in; **also clears `purgeWarningSentAt` and `purgeFinalWarningSentAt`** so any sign-in resets the inactivity clock. Indexed for fast cron scans. |
| `purgeExempt` | `BOOLEAN` | Default `false`. When `true`, the account-purge cron skips this row at every stage. Migration sets `true` for all existing `ADMIN` users; admin can toggle per-user from `/admin/users`. Wired as the paid-tier exemption hook for v2 monetisation. |
| `purgeWarningSentAt` | `TIMESTAMP?` | Set by the cron when the 14-day warning email is sent. Idempotency stamp — prevents re-sending. Cleared on any sign-in. |
| `purgeFinalWarningSentAt` | `TIMESTAMP?` | Set by the cron when the 3-day warning email is sent. Same idempotency role. |
| `currency` | `TEXT NOT NULL DEFAULT 'GBP'` | ISO 4217 currency code. Used by `/my-collection` to format cost via `Intl.NumberFormat`. User picks from the list in [lib/currency.ts](../lib/currency.ts) `CURRENCIES`. Default `GBP` keeps v1.4.0 collections rendering the same after migration. |

**Relations:**
- `sessions` — Auth.js Session rows (cascade delete; not actively used while JWT strategy is active, but kept for v2 OAuth).
- `accounts` — Auth.js Account rows (OAuth links; v2).
- `blends` — owned blends. FK is `ON DELETE SET NULL`, so deleting the user turns their blends anonymous rather than destroying them.

**Account lifecycle (v1.3.0):** `/api/cron/account-purge` runs daily. With activity anchor = `lastSignInAt ?? createdAt`:

- Stage 1 (`> 1y − 14d` inactive, no warning sent yet, not exempt) → send 14-day warning, stamp `purgeWarningSentAt`.
- Stage 2 (`> 1y − 3d` inactive, first warning sent, no final, not exempt) → send 3-day warning, stamp `purgeFinalWarningSentAt`.
- Stage 3 (`> 1y` inactive, both warnings sent, not exempt) → `deleteMany`. Cascade: sessions/accounts drop; blends → `userId = null`.

### `Session`

Auth.js v5 conventional session table. **Not actively used in v1.x** — we run with `session: { strategy: 'jwt' }`, so the session lives in the signed cookie, not here. Kept in the schema because Auth.js's Prisma adapter requires it for the OAuth flows coming in v2.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` (cuid) | Primary key |
| `sessionToken` | `TEXT UNIQUE` | Auth.js random opaque token |
| `userId` | `TEXT` | FK → `User.id`; ON DELETE CASCADE |
| `expires` | `TIMESTAMP` | Session expiry |

Indexed on `userId`.

### `Account`

OAuth provider link rows per Auth.js convention. **Empty in v1.x** — populated when v2 ships Google / Microsoft / GitHub providers.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` (cuid) | Primary key |
| `userId` | `TEXT` | FK → `User.id`; ON DELETE CASCADE |
| `type` | `TEXT` | `"oauth"`, `"oidc"`, `"email"`, or `"credentials"` |
| `provider` | `TEXT` | `"google"`, `"microsoft"`, `"github"`, etc. |
| `providerAccountId` | `TEXT` | Provider-side user identifier |
| `refresh_token` / `access_token` / `id_token` | `TEXT?` | Per-provider tokens |
| `expires_at` | `INT?` | Token expiry (unix seconds) |
| `token_type` / `scope` / `session_state` | `TEXT?` | Provider metadata |

`@@unique([provider, providerAccountId])` prevents the same provider account being linked to two `User`s.

### `VerificationToken`

Email-verification and password-reset tokens. One table, both purposes, discriminated by `purpose`.

| Column | Type | Notes |
|--------|------|-------|
| `identifier` | `TEXT` | Email address (lowercased) for both purposes |
| `token` | `TEXT UNIQUE` | 64 hex chars (`crypto.randomBytes(32).toString('hex')`); single-use |
| `expires` | `TIMESTAMP` | 24 h for `EMAIL_VERIFY`, 1 h for `PASSWORD_RESET` |
| `purpose` | `TEXT` | `"EMAIL_VERIFY"` or `"PASSWORD_RESET"`. Default `"EMAIL_VERIFY"`. |

`@@unique([identifier, token])` + `@@index([identifier])`.

### `Settings`

Site-wide toggles. Single row, primary key `id = "singleton"`. Created on first read via `prisma.settings.findUnique` + `create`-if-missing; cached per request via `React.cache()`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` | Always `"singleton"` |
| `tooltipsEnabled` | `BOOLEAN` | Default `true`. Master kill for inline `<HelpTooltip>` banners. |
| `issueReportingEnabled` | `BOOLEAN` | Default `true`. Toggles the "Report it on GitHub" line in the footer. |
| `allowAnonymousSaves` | `BOOLEAN` | Default `true`. When `false`, `POST /api/blends` requires a signed-in user. |
| `legacyAdminEnabled` | `BOOLEAN` | Default `true`. Master kill for the `ADMIN_SECRET` cookie login. When `false`, `/admin/login` returns 404 and `proxy.ts` rejects the cookie path; only `User.role === 'ADMIN'` sessions reach `/admin/*`. The `FORCE_LEGACY_ADMIN_LOGIN=1` env var overrides this for emergency recovery. |
| `maintenanceMode` | `BOOLEAN` | Default `false`. Operator kill-switch. When `true`, `proxy.ts` rewrites every public route to `/maintenance` (and returns 503 JSON for public `/api/*` requests). `/admin/*`, `/api/auth/*`, and `/api/cron/*` are exempt so the operator can flip it back off and cron jobs continue. |

The Settings UI refuses to flip `legacyAdminEnabled` off when zero `User`s have `role = 'ADMIN'`.

### `UserRole` enum

| Value | Notes |
|-------|-------|
| `USER` | Default. Standard user with no admin powers. |
| `ADMIN` | Reaches `/admin/*` without the legacy cookie. `purgeExempt = true` for all such rows at v1.3.0 migration time (existing admins keep their accounts even if they don't sign in for a year). New admins promoted via `/admin/users` start un-exempt; admin can flip per-user. |

---

## Relationships

```
Oil
 ├── pairsWithA ──► OilPairing.oilAId  ─┐
 └── pairsWithB ──► OilPairing.oilBId  ─┘  (one row per pair, IDs sorted)

Oil
 └── blendIngredients ──► BlendIngredient.oilId
                                │
Blend ◄── BlendIngredient.blendId
```

---

## Migration History

| Migration | What changed |
|-----------|-------------|
| `20260501232508_init` | Initial schema: `Oil`, `OilPairing`, `Blend`, `BlendIngredient`; both enums |
| `20260504000000_add_oil_image` | Added `Oil.imageUrl`, `Oil.imageAlt` |
| `20260504000002_blend_stats_featured` | Added `Blend.viewCount`, `lastAccessedAt`, `authorName`, `about`, `isFeatured`, `isPinned`, `isHidden` |
| `20260505000000_oil_enrichment_metadata` | Added `Oil.enrichedAt`, `Oil.enrichmentModel`; backfills existing rows with `NOW()` and `'claude-sonnet-4-6'` |
| `20260506000000_clear_enrichment_backfill` | Clears the v0.1.0 backfill so re-enriching is genuinely idempotent |
| `20260509000000_settings_singleton` | New `Settings` table (singleton row); `tooltipsEnabled`, `issueReportingEnabled` |
| `20260526000000_v11_auth_foundation` | Auth.js v5 + Prisma adapter: `User`, `Session`, `Account`, `VerificationToken`; `UserRole` enum |
| `20260526000001_user_firstname_lastname` | Added `User.firstName` + `User.lastName` (NOT NULL DEFAULT `''` to cover any v1.1.0-dev rows) |
| `20260526000002_v12_blend_ownership` | Added `Blend.userId` (nullable FK, ON DELETE SET NULL), `Blend.isShared`, `Settings.allowAnonymousSaves` |
| `20260526000003_settings_legacy_admin_toggle` | Added `Settings.legacyAdminEnabled` (default `true`) |
| `20260529000000_user_lifecycle` | Added `User.lastSignInAt` (indexed), `User.purgeExempt`, `User.purgeWarningSentAt`, `User.purgeFinalWarningSentAt`; backfills `purgeExempt = true` for all existing `ADMIN` users |
| `20260530000000_user_oil_collection` | New `UserOilCollection` table for per-user oil inventory; `@@unique([userId, oilId])`, indexed on `userId`. Cascade from User, restrict from Oil. |
| `20260530000001_settings_maintenance_mode` | Added `Settings.maintenanceMode` for the operator kill-switch. |
| `20260530000002_currency_and_bottle_size` | Added `User.currency` (ISO 4217 code, default `GBP`) and `UserOilCollection.bottleSizeMl` (float, nullable). |

Migrations are applied automatically at container startup via [`scripts/migrate.js`](../scripts/migrate.js), which uses the `pg` package directly (no Prisma CLI required in the runtime image).

---

## Seeding and Enrichment

**Seed** (`scripts/seed.ts` / `seed.js`) — upserts ~55 oils from [`scripts/oil-definitions.ts`](../scripts/oil-definitions.ts) and ~96 hand-curated EXCELLENT/CAUTION/UNSAFE pairings. Safe to re-run at any time.

**Enrich** (`scripts/enrich-oils.ts` / `enrich.js`) — calls the Claude API to generate richer oil data (botanical context, origin, history, full descriptions) and a complete AI-generated pairing matrix for every oil. By default only oils with `enrichedAt IS NULL` are processed; set `FORCE_REENRICH=1` to re-enrich all. Stamps `enrichedAt` and `enrichmentModel` on every successful upsert. Runs in three passes:
1. Enrich and upsert all oil fields (skipping already-enriched unless forced)
2. Upsert all AI-generated pairings
3. Apply UNSAFE overrides from `unsafe-pairs.ts` (hand-curated, never AI-generated)

Both scripts can be triggered from the Admin → Database panel in the web UI.
