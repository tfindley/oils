# Development Guide

This guide covers setting up Oil Blender for local development: running from source, making schema changes, and using the enrichment pipeline.

For deploying the pre-built container image, see the main [README](../README.md).

---

## Prerequisites

- Node.js 20+
- PostgreSQL 16 (or Docker for local dev)
- An Anthropic API key (only needed to run the enrichment script)

---

## Setup

### 1. Clone & Install

```bash
git clone https://github.com/tfindley/oil-blender.git
cd oil-blender
npm install
npx prisma generate
```

> `npx prisma generate` must be run once after install, and again after any schema change. The error `Cannot find module '.prisma/client/default'` means this step was skipped.

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
DATABASE_URL="postgresql://oils:oils@localhost:5432/oils"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
ADMIN_SECRET="your-strong-admin-password"
CRON_SECRET="your-strong-cron-secret"
AUTH_SECRET="$(openssl rand -base64 32)"        # signs Auth.js session cookies

# Optional
NEXT_PUBLIC_SITE_NAME="Oil Blender"
NEXT_PUBLIC_GA_MEASUREMENT_ID="G-XXXXXXXXXX"   # omit to disable analytics
ANTHROPIC_API_KEY="sk-ant-..."                  # only needed for npm run enrich
RESEND_API_KEY=""                               # if set, real verification emails go via Resend
SMTP_HOST=""                                    # alternative: Nodemailer SMTP
# FORCE_LEGACY_ADMIN_LOGIN="1"                  # emergency-only — re-enables /admin/login if user-based admin access is lost
```

> `AUTH_SECRET` has a dev fallback (`auth.ts` sets a fixed dummy when `NODE_ENV !== 'production'` and unset), so dev still works without it. Set it explicitly anyway so you don't carry the fallback into a build artifact by accident.

### 3. Start PostgreSQL

**With Docker (standalone container, port exposed for local access):**
```bash
docker run -d --name oils-db -p 5432:5432 \
  -e POSTGRES_USER=oils -e POSTGRES_PASSWORD=oils -e POSTGRES_DB=oils \
  postgres:16-alpine
```

> The production `docker-compose.yml` does not expose the database port to the host — use the standalone `docker run` command above for development.

**With an existing PostgreSQL install:**
```bash
psql -U postgres -c "CREATE USER oils WITH PASSWORD 'oils' CREATEDB;"
psql -U postgres -c "CREATE DATABASE oils OWNER oils;"
```

### 4. Run Migrations

```bash
node scripts/migrate.js
```

### 5. Seed the Database

**Option A — Quick seed (no API key needed):**
```bash
npm run seed
```
This loads 55 oils and ~96 curated pairings from `scripts/seed.ts`.

**Option B — Full AI enrichment (requires Anthropic API key):**
```bash
npm run enrich
```
This calls Claude to generate richer descriptions and a complete pairing matrix for all oils. The enrichment is idempotent — safe to re-run.

### 6. Start the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Stale cache?** If a Tailwind class change, server-component output, or Prisma type doesn't seem to update, clear the Next.js build cache and restart: `rm -rf .next && npm run dev`. HMR usually picks up changes on its own — only reach for this when something looks frozen.

### Local email in dev (signup verification, password reset)

When neither `RESEND_API_KEY` nor `SMTP_HOST` is configured **and** `NODE_ENV !== 'production'`, `lib/email.ts` falls back to logging email contents to the server console. This lets the signup → verify-email flow work end-to-end without any email-provider setup.

When you submit the signup form, look at the `npm run dev` terminal for:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[email:dev-console] No email transport configured.
  To:      you@example.com
  Subject: Verify your Oil Blender account
  Text:
    Welcome to Oil Blender.
    Confirm your email by visiting:
    http://localhost:3000/verify-email?token=...
    ...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Paste the URL into the browser to verify the account.

For staging / production deployments, set either `RESEND_API_KEY` or `SMTP_HOST` (plus `EMAIL_FROM`) so real emails get delivered. See [.env.example](../.env.example) for the full list of mail-related env vars.

---

## First-Time Admin Bootstrap

A fresh install has zero `User` accounts. The first admin is the chicken-and-egg problem; v1.2.1 ships a deliberate three-path solution:

1. **Sign in via the legacy `/admin/login` form** using `ADMIN_SECRET` from your env. This is the bootstrap path — always available unless explicitly disabled.
2. **Sign up a user account** at `/signup`. In dev with no email transport configured, the verification URL is printed to the server console (see the section above). Click through the link to flip `emailVerified`.
3. **Promote the account** — go to `/admin/users` (still signed in via the legacy cookie), find your account, click **Promote to admin**.
4. **Sign in as that user account** at `/login` and confirm `/admin` works.
5. **Optional but recommended for production**: visit `/admin/settings` and turn off **Legacy admin login (ADMIN_SECRET cookie)**. From this point only `User.role === 'ADMIN'` sessions reach `/admin/*`.
6. **Recovery**: if you ever lose user-based admin access (lost password, OAuth outage in v2+, etc.), set `FORCE_LEGACY_ADMIN_LOGIN=1` in the container env and restart. `/admin/login` reappears regardless of the Settings toggle. Unset and restart once recovered.

The `purgeExempt` flag on every existing `ADMIN` row is set to `true` by the v1.3.0 migration so the inactivity-based account-purge cron never deletes a global admin. New admins promoted via `/admin/users` start with `purgeExempt = false`; toggle as needed.

---

## Schema Changes

1. Edit `prisma/schema.prisma`
2. Create a new migration file in `prisma/migrations/<timestamp>_<name>/migration.sql`
3. Run `node scripts/migrate.js` to apply it
4. Run `npx prisma generate` to regenerate the client

The migration runner (`scripts/migrate.js`) tracks applied migrations in `_prisma_migrations` — the same table Prisma CLI uses, so the two approaches are interchangeable.

---

## Enrichment Pipeline

`npm run enrich` runs a three-pass pipeline:

| Pass | What it does |
|------|------|
| **Pass 1** | Calls Claude API for each *unenriched* oil — generates full data including pairings; stamps `enrichedAt` and `enrichmentModel` on each upsert |
| **Pass 2** | Resolves pairing oil names → database IDs; upserts pairing records |
| **Pass 3** | Applies UNSAFE overrides from `scripts/unsafe-pairs.ts` (hand-curated, never AI-generated) |

- **Skips already-enriched oils by default** — only oils where `enrichedAt IS NULL` are processed; set `FORCE_REENRICH=1` to override: `FORCE_REENRICH=1 npm run enrich`
- Rate-limited to 8 concurrent API calls (`p-limit`)
- Fully idempotent — safe to re-run after failures
- Approximate cost: ~$0.05–0.15 USD for a full run of all 55 oils; re-runs on a fully enriched database cost nothing
- Model constant exported as `ENRICHMENT_MODEL` from `lib/oil-enrichment.ts`

---

## Project Structure

```
oil-blender/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Homepage (hero + featured blends + feature grid)
│   ├── blend/              # Blend builder + saved blend detail
│   ├── blends/             # Public featured blends listing
│   ├── oils/               # Oil catalog + individual oil pages + compare + matrix
│   ├── about/              # About page (privacy, analytics, tech stack, PWA install)
│   ├── admin/              # Admin panel (oils + blends management)
│   │   ├── page.tsx        # Oil list
│   │   ├── oils/           # Oil create/edit
│   │   ├── blends/         # Blend list, edit, import/promote
│   │   └── database/       # Seed and enrichment tools
│   ├── signup/             # Email + password signup (v1.1.0+)
│   ├── login/              # Sign-in form
│   ├── logout/             # POST-only sign-out (CSRF-safe)
│   ├── verify-email/       # Token-based email verification handler
│   ├── forgot-password/    # Password-reset request form
│   ├── reset-password/     # Password-reset confirm form
│   ├── account/            # /account profile page (display-name picker, change password, delete)
│   ├── my-blends/          # Signed-in user's saved blends
│   └── api/                # REST API + cron routes
│       ├── auth/[...nextauth]/  # Auth.js v5 handlers
│       ├── blends/              # Create / fetch blends (access-controlled)
│       ├── oils/                # Oil data
│       ├── pairings/            # Pairing queries
│       └── cron/
│           ├── purge/           # Anonymous blend auto-purge
│           └── account-purge/   # Inactive-account lifecycle (warns + deletes)
├── components/
│   ├── analytics/          # GoogleAnalytics component
│   ├── ui/                 # Button, Badge, Card, Input/Textarea, Alert, CopyButton
│   ├── layout/             # Header, Footer, MobileMenu, ThemeToggle
│   ├── blend/              # BlendBuilder (tabs), OilPicker, NumberStepper, BlendCart, CompatibilityPanel, QuantityTable, BlendScaler, SelectedOilsCard…
│   ├── blends/             # BlendCard (public-facing)
│   ├── oils/               # OilCard, AddToBlendButton, AddToCompareButton, OilCompare, CompatibilityMatrix
│   └── pdf/                # BlendReport (@react-pdf/renderer)
├── lib/
│   ├── prisma.ts           # Prisma client singleton
│   ├── blend-calculator.ts # Volume/drop calculations; DROPS_PER_ML, pctToDrops, dropsToPct
│   ├── blend-scorer.ts     # A–F blend grading; exports BlendGrade, ScoredPairing
│   ├── blend-storage.ts    # localStorage persistence for the in-progress blend draft (v: 2)
│   ├── compare-storage.ts  # localStorage persistence for the two compare slots (v: 2)
│   ├── grade-styles.ts     # Shared A/B/C/F badge classes (used by BlendCart and BlendCard)
│   ├── pairing-utils.ts    # Shared pairing key / map utilities
│   ├── use-drag-scroll.ts  # Pointer-event drag-to-scroll hook (Compatibility Matrix)
│   ├── oil-enrichment.ts   # Claude enrichment helper (prompt caching, truncation retry); exports ENRICHMENT_MODEL
│   ├── format-time.ts      # relativeTime(date) helper
│   ├── settings.ts         # SiteSettings singleton, React.cache-wrapped getSettings()
│   ├── admin-auth.ts       # Legacy HMAC token + isAdminAuthenticated() shared helper
│   ├── rate-limit.ts       # Namespaced IP-keyed token-bucket
│   └── email.ts            # Three-tier email transport (Resend / SMTP / dev console) + template helpers
├── auth.ts                 # Auth.js v5 config (Credentials provider, JWT callbacks, lastSignInAt stamping)
├── types/next-auth.d.ts    # Session augmentation: id/role/emailVerified on session.user
├── scripts/
│   ├── migrate.js          # Lightweight migration runner (uses pg, no Prisma CLI)
│   ├── oil-definitions.ts  # Oil name list
│   ├── unsafe-pairs.ts     # Hand-curated UNSAFE combinations
│   ├── seed.ts             # Seed with built-in oil data (no API key needed)
│   └── enrich-oils.ts      # Claude AI enrichment pipeline
├── types/index.ts          # Shared TypeScript types
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # SQL migration files
├── .env.example            # Environment variable template
├── Dockerfile              # Multi-stage production build
└── .github/workflows/
    └── release.yml         # Tag-triggered build + push + release
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/oils` | List oils — `?type=ESSENTIAL\|CARRIER&q=search` |
| `GET` | `/api/oils/[id]` | Single oil with all pairings |
| `GET` | `/api/pairings` | `?oilIds=id1,id2,id3` — pairings between selected oils |
| `POST` | `/api/blends` | Create blend (validates no UNSAFE pairs server-side; attaches `userId` when signed in; honours `Settings.allowAnonymousSaves`) |
| `GET` | `/api/blends/[id]` | Blend detail with ingredients and pairings. Enforces the same access control as `/blend/[id]` — private owned blends return 404 to non-owners. |
| `GET / POST` | `/api/auth/[...nextauth]` | Auth.js v5 catch-all (sign-in / callback / etc.) |
| `GET` | `/api/cron/purge` | Delete inactive **anonymous** blends (requires `Authorization: Bearer <CRON_SECRET>`); owned blends are exempt |
| `GET` | `/api/cron/account-purge` | Inactivity-based account lifecycle — sends 14-day and 3-day warnings then deletes (same Bearer auth) |

---

## Building the Container

```bash
docker build -t oil-blender .
```

The build compiles seed and enrichment scripts to plain JS (via esbuild) so they can be run inside the container without any Node toolchain:

```bash
docker compose exec app node scripts/seed.js
docker compose exec -e ANTHROPIC_API_KEY=sk-ant-... app node scripts/enrich.js
```

Alternatively, use the **Admin → Database** panel at `/admin/database` to trigger either operation from the browser.

---

## Releasing

Releases are managed via GitHub Actions (`.github/workflows/release.yml`).

```bash
git tag v1.0.0
git push origin v1.0.0
```

This automatically:
1. Builds the Docker image
2. Pushes `ghcr.io/tfindley/oil-blender:1.0.0` and `ghcr.io/tfindley/oil-blender:latest` to GHCR
3. Creates a GitHub Release with Docker run instructions

---

## Contributing

Issues and PRs welcome at [github.com/tfindley/oil-blender](https://github.com/tfindley/oil-blender/issues).

If you find an error in the oil data, incorrect safety information, or a missing UNSAFE pair, please open an issue — safety corrections are the highest priority.

---

## Compatibility Rating System

| Rating | Description | Behaviour |
|--------|-------------|-----------|
| **EXCELLENT** | Actively beneficial together | Highlighted in UI |
| **GOOD** | Compatible, no concerns | No note shown |
| **CAUTION** | Mild concern | Amber warning shown — user can proceed |
| **AVOID** | Not recommended | Red warning — user must acknowledge before saving |
| **UNSAFE** | Dangerous combination | Hard block — cannot be saved |

Blend grade is derived from the worst pairing:
- **A** — all GOOD or EXCELLENT
- **B** — at least one CAUTION, no AVOID/UNSAFE
- **C** — at least one AVOID (user must acknowledge)
- **F** — any UNSAFE pair (blocked entirely)
