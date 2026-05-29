<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Where things live

- `auth.ts` — Auth.js v5 config (Credentials provider, JWT session strategy, JWT callback stamps `User.lastSignInAt` and clears purge warnings on sign-in). Pages defined: `/login`, `verifyRequest=/login?check=email`.
- `proxy.ts` — Next.js 16 proxy. Two stages on every request: (1) maintenance gate (`Settings.maintenanceMode` rewrites public requests to `/maintenance`, returns 503 JSON for `/api/*`; exempts `/admin/*`, `/maintenance`, `/api/auth/*`, `/api/cron/*`); (2) admin gate — three valid paths to `/admin/*`: `session.user.role === 'ADMIN'`, the legacy `admin_token` cookie (gated by `Settings.legacyAdminEnabled` + `FORCE_LEGACY_ADMIN_LOGIN` env), or `/admin/login` itself. Matcher covers the whole site (exempting Next.js internals + favicons). Always runs on Node runtime.
- `lib/admin-auth.ts` — legacy HMAC token mint/verify **plus** `isAdminAuthenticated()`, the single-source-of-truth gate used by admin server actions for defence-in-depth. Mirrors the proxy's three-path logic; fail-closed on settings lookup error.
- `app/admin/` — admin panel. `layout.tsx` server-side gates `<AdminNav>` rendering on its own `isAdminAuthenticated`-flavour check (defence-in-depth on top of the proxy).
- `components/blend/` — blend builder UI:
  - `BlendBuilder.tsx` — top-level builder; owns all blend state, the active tab (`Carriers / Essentials / Quantities / Save`), hydration from localStorage, and save flow.
  - `OilPicker.tsx` — shared body-only picker used for both carriers (Tab 1) and essential oils (Tab 2). Identical highlight-toggle behaviour; props are `oils`, `selectedOils`, `noun`, `maxCount`, etc. No card shell or accordion header — the parent tab provides title/subtitle.
  - `NumberStepper.tsx` — `[−] [N] [+]` widget (36 px touch targets) used for ml (carriers) and drops (EOs) on the Quantities tab; supports an `over` red palette for over-max-dilution rows.
  - `SelectedOilsCard.tsx` — "In Your Blend" right-column summary; vertical list with per-row ✕ and the Reset button in the card header.
  - `QuantityTable.tsx` — read-only summary table on Tab 4; carriers show `—` in `%` (ml is source of truth there).
  - `BlendScaler.tsx` — saved-blend volume rescaler on the detail page.
  - `BlendCart.tsx` — header widget. Reads `loadDraft()`, renders the flask icon + two-tone count badge + dropdown panel; computes/persists the A–F grade by fetching `/api/pairings` (skipped on `/blend` to avoid double-fetching the builder's own grade).
- `lib/blend-calculator.ts` — pure math + types for `calculateBlend`. Exports `DROPS_PER_ML`, `pctToDrops`, `dropsToPct`. Carrier ingredients pass `volumeMl` directly; the calculator no longer renormalises by `sumCarrierPct`.
- `lib/blend-scorer.ts` — pure scoring; exports `BlendGrade`, `ScoredPairing`, `scoreBlend()`.
- `lib/blend-storage.ts` — localStorage helpers for the in-progress blend draft (schema `v: 2`); fires the `oil-blender:draft-changed` custom event so same-tab listeners stay in sync.
- `lib/compare-storage.ts` — localStorage helpers for the two compare slots (schema `v: 2`); `pushToCompare` returns `'A' | 'B' | 'full' | 'already'` so callers can show the named-slot Replace popover.
- `lib/grade-styles.ts` — shared `Record<BlendGrade, string>` of badge classes; consumed by `BlendCart` and `BlendCard`.
- `lib/pairing-utils.ts` — pairing helpers (`sortPairingIds`, `pairingKey`, `buildPairingMap`).
- `lib/use-drag-scroll.ts` — Pointer-event drag-to-scroll hook (used by `<CompatibilityMatrix>`); skips drag when the pointer-down target is a button/link/input.
- `lib/oil-enrichment.ts` — Claude-backed enrichment helper (prompt caching + truncation retry baked in); exports `ENRICHMENT_MODEL`.
- `lib/format-time.ts` — `relativeTime(date)` helper used across admin pages.
- `lib/email.ts` — three-tier email transport (`RESEND_API_KEY` → `SMTP_HOST` → dev-console). Exports `verificationEmail`, `passwordResetEmail`, `accountInactivityWarningEmail` template helpers.
- `lib/settings.ts` — `SiteSettings` singleton (`getSettings()` wrapped in `React.cache()`; default values applied if the row is missing or query throws). Drives `tooltipsEnabled`, `issueReportingEnabled`, `allowAnonymousSaves`, `legacyAdminEnabled`.
- `app/account/display-name.ts` — pure (non-async) display-name format helper imported by both the server action and the client form. Five formats: `first-last`, `last-first`, `first-l`, `f-last`, `anonymous` (always returns `"Anonymous"`), `custom`. **Server-action files can only export async functions — put sync helpers in a separate file like this one.**
- `app/api/cron/purge/route.ts` — anonymous blend purge (30-day inactivity). Filters `userId: null` so owned blends are exempt.
- `app/api/cron/account-purge/route.ts` — inactive-account lifecycle. 14-day warning → 3-day warning → delete. Activity anchor is `lastSignInAt ?? createdAt`. Skips `purgeExempt = true` at every stage.
- `app/my-collection/` — personal oil collection (v1.4.0). `page.tsx` server component reads `UserOilCollection` rows with related `Oil`; `CollectionList.tsx` client component owns inline-edit state per row via `useTransition`. `actions.ts` exports `addToCollectionAction`, `removeFromCollectionAction`, `updateCollectionEntryAction` — all auth-gated, all scoped via `deleteMany`/`updateMany` with `userId` so a caller can never touch another user's row.
- `components/oils/AddToCollectionButton.tsx` — asymmetric button on `/oils/[id]`. Adds on click when not in collection (optimistic, rolls back on error); when already in collection it becomes a `Link` to `/my-collection#oil-<id>` (no remove from the oil browser — too easy to misclick). "Sign in to track" CTA for signed-out viewers.
- `lib/currency.ts` — `CURRENCIES` list (ISO 4217), `formatCurrency()` via `Intl.NumberFormat`, `isSupportedCurrency()` guard, `DEFAULT_CURRENCY = 'GBP'`. Single source of truth for currency display; adding a new currency option = one entry in `CURRENCIES` and nothing else.
- `scripts/migrate.js` — lightweight `pg`-only migration runner. The Prisma CLI is NOT in the runner image.
- `scripts/seed.ts`, `scripts/enrich-oils.ts` — esbuilt to `.js` for the runner; locally run via `tsx`.
- `docs/DATABASE.md` — full schema reference (models, relationships, enum semantics, migration history).
- `docs/DEVELOPMENT.md` — local dev setup. `README.md` — deployment.

# Gotchas

- **OilPairing is bidirectional, stored once.** Sort IDs with `sortPairingIds()` before insert/upsert; look up with `pairingKey()`. Querying with unsorted IDs misses half the rows.
- **TS files import siblings with `.js` suffix** (TS ESM convention). Both `tsx` and `esbuild --bundle` resolve `.js` → `.ts` automatically.
- **Migrations run at container start** via `scripts/migrate.js` — don't expect `prisma migrate deploy` in production.
- **DB-backed pages need `export const dynamic = 'force-dynamic'`** — `next build` runs without a database.
- **`revalidatePath('/admin/oils/[id]')` does NOT expand `[id]`.** Pass the resolved path: `` revalidatePath(`/admin/oils/${id}`) ``.
- **Anthropic prompt caching:** `cache_control: { type: 'ephemeral' }` goes on the LAST cacheable text block; the dynamic suffix follows it uncached.
- **Blend volume model is additive** — `totalVolumeMl` (the user's "Volume" input) is the **carrier volume target**, not the final mix volume. EOs add on top: `finalVolumeMl = carrierVolumeMl + totalVolumeMl × dilutionRate`. The carrier is locked at the chosen volume; this matches aromatherapy practice.
- **Carrier ingredients use `volumeMl` directly** — `BlendIngredient.volumeMl` is the source of truth for carriers (not derived from `percentagePct`). EO ingredients still use `percentagePct` (drops are derived via `pctToDrops`). When loading saved blends into the builder, pass `volumeMl` through unchanged.
- **`@@unique([blendId, oilId])`** on `BlendIngredient` blocks the same oil appearing twice in one blend — that's intentional. Multiple *different* carriers (or EOs) are fine.
- **The blend draft persists across pages via localStorage** (`lib/blend-storage.ts`). `BlendBuilder` is the source of truth on `/blend` and writes the grade itself; `BlendCart` computes/writes the grade on every other page. If you add a new field to `BlendDraft`, bump the schema version and handle the migration — `loadDraft` returns `null` on version mismatch and silently drops old data.
- **localStorage helpers fire same-tab change events.** `oil-blender:draft-changed` (blend) and `oil-blender:compare-changed` (compare slots) are dispatched on every write. Listeners must subscribe to both `'storage'` (cross-tab) and the custom event (same-tab) — see `BlendCart`'s `useEffect` for the pattern.
- **`BlendBuilder` auto-save empty-check is oils-only**, not name/notes-aware. A blend name without any oils is not a blend — the auto-save effect `clearDraft()`s when both `selectedCarriers.length === 0` and `selectedEOs.length === 0`, regardless of `blendName`/`blendNotes`. The `handleSave` success branch also explicitly `setBlendName('')` and `setBlendNotes('')` before `router.push` so the post-save `draft-changed` cascade can't repopulate the draft from stale React state. Don't reintroduce a name/notes check in the empty branch.
- **Blend ownership semantics.** `Blend.userId` is nullable. Anonymous blends are public by URL forever; owned blends gate on `isShared`. Access check is duplicated between `app/blend/[id]/page.tsx` and `app/api/blends/[id]/route.ts` — keep them in sync. Public listings (`/blends`, homepage featured) must include `OR: [userId: null, isShared: true]` even when filtering by `isFeatured`/`isPinned`. The `?from=<id>` clone path in `/blend` does the same access check before populating the builder.
- **`isAdminAuthenticated()` from `lib/admin-auth.ts`** is the defence-in-depth gate for admin server actions. Any new mutation in `app/admin/*/actions.ts` should call it at the top and return a `NOT_ADMIN` shape on `false`. The proxy gates path-based navigation but server actions are POSTed to arbitrary URLs — don't trust the proxy alone.
- **Auth.js JWT strategy** — `auth.ts` uses `session: { strategy: 'jwt' }` because the Credentials provider requires it. The `Session` Prisma table is empty in v1.x; it's kept in the schema for the v2 OAuth providers. The `jwt` callback's "user is present" branch does a `prisma.user.update` (not `findUnique`) to stamp `lastSignInAt = now()` and clear purge warnings on every sign-in. Role / `emailVerified` changes don't propagate to active JWTs until token expiry (~30 days) or explicit `useSession().update()` — a known limitation, deferred to a future `passwordVersion`-style mechanism.
- **Owned blends are exempt from the 30-day blend auto-purge** (`app/api/cron/purge/route.ts` filters `userId: null`). Owned blends live for the lifetime of the user account. The annual account-purge (`app/api/cron/account-purge/route.ts`) is what removes inactive owned data.
- **Account lifecycle** is anchored on `User.lastSignInAt ?? User.createdAt`. Stage 1 (≥1y−14d inactive): send 14-day warning, stamp `purgeWarningSentAt`. Stage 2 (≥1y−3d): send 3-day warning, stamp `purgeFinalWarningSentAt`. Stage 3 (≥1y, both warnings sent): delete. Every sign-in resets `lastSignInAt` AND clears both warning stamps in the JWT callback. `purgeExempt: true` short-circuits every stage — set automatically on existing ADMINs at migration time; manual toggle per user from `/admin/users`.
- **Collection FK is RESTRICT, not CASCADE, from `Oil`.** You cannot delete an oil from `/admin` while any user has it in their collection — Prisma will throw a foreign-key violation. Either remove all user collection entries first (a sweeping admin action, not currently in the UI) or rename / re-purpose the oil row instead of deleting. Cascade from `User` is fine — deleting a user wipes their collection.
- **Collection actions are scoped via `updateMany`/`deleteMany` with `where: { userId, oilId }`** — same defensive pattern as `claimBlendAction`. Never use `findUnique` then `update` for user-owned rows; the read-then-write split lets a caller's missing-row case be misinterpreted as success.
- **Auth.js maps any error inside `authorize()` or the `jwt` callback to a generic `CredentialsSignin`** ("Email or password incorrect"). If you add code to either callback that can throw (e.g. a Prisma write referencing a new column), wrap it in try/catch and fall through — otherwise schema drift or a transient DB error will lock real users out with a misleading message. See [auth.ts](auth.ts) jwt-callback pattern.
- **React 19 resets uncontrolled form fields after a server action completes.** Combined with Next 16's `revalidatePath()` (which updates the cache but doesn't synchronously re-render the calling page), uncontrolled `<input defaultValue=…>` / `<select defaultValue=…>` will visibly revert to the props' previous value on save. For any form whose fields hold server-derived state that the action mutates, use controlled inputs with `useState` + `useEffect` to sync from props — see [`app/account/AccountForms.tsx`](app/account/AccountForms.tsx) `ProfileForm` for the canonical pattern.
- **Maintenance mode (`Settings.maintenanceMode`)** is an operator kill-switch that runs in `proxy.ts` Stage 1. Exemptions: `/admin/*`, `/maintenance`, `/api/auth/*`, `/api/cron/*`. The rewrite (not redirect) preserves the user's original URL so a refresh lands them on the page they were going to once maintenance ends. Anything new that needs to keep working during maintenance (a new public-facing programmatic endpoint, an OAuth callback path) must be added to the exempt list in `proxy.ts` `isMaintenanceExempt()`. Toggling lives in a dedicated client component (`app/admin/settings/MaintenanceModeCard.tsx`) with a confirm dialog and a dedicated action (`toggleMaintenanceModeAction`) — NOT in the cosmetic-toggles form. Don't move it back into the shared `saveSettings` flow; the separation prevents accidental engagement and lets the recovery instructions live next to the toggle.
- **No test suite.** Verification = `npx tsc --noEmit` plus running the dev server.

# Common commands

- `npx tsc --noEmit` — typecheck
- `npm run dev` / `build` / `seed` / `enrich`
- `docker compose -f docker-compose.yml -f docker-compose.build.yml up --build` — local build with override
- Add migration: edit `prisma/schema.prisma` → `npx prisma migrate dev --name <slug>` → commit the generated SQL file
