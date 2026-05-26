# Oil Blender

**A free, open-source massage oil blend builder with real-time compatibility scoring, safety guidance, and printable recipe cards.**

[![Release](https://img.shields.io/github/v/release/tfindley/oil-blender)](https://github.com/tfindley/oil-blender/releases)
[![Build](https://github.com/tfindley/oil-blender/actions/workflows/release.yml/badge.svg)](https://github.com/tfindley/oil-blender/actions/workflows/release.yml)
[![Docker](https://img.shields.io/badge/ghcr.io-tfindley%2Foil-blender-blue)](https://github.com/tfindley/oil-blender/pkgs/container/oil-blender)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What It Does

Oil Blender lets you:

- **Build a blend** — pick up to 5 carrier oils (jojoba + sweet almond, etc.) and up to 5 essential oils
- **See compatibility live** — every oil pair is rated Excellent / Good / Caution / Avoid / Unsafe
- **Get exact quantities** — carriers in ml, essential oils in drops; additive carrier model (100 ml carrier + 3% EOs = 103 ml final)
- **Download a PDF recipe card** — with ingredients, oil profiles, pairing notes, and a QR code
- **Share your blend** — every saved blend gets a permanent URL
- **Browse curated blends** — featured community blends on the homepage and `/blends`

---

## Features

| Feature | Detail |
|---|---|
| Blend builder | Tabbed UI (Carriers / Essentials / Quantities / Save), up to 5 carriers + up to 5 EOs, live compatibility panel, search/browse picker, +/- steppers |
| Cross-page persistence | In-progress blend stays alive when you navigate to the oil library or compare tool; header BlendCart shows running A–F grade from any page |
| Multi-carrier blending | Mix multiple carriers (e.g. 50 ml jojoba + 50 ml sweet almond); ml-based input with drift warning + "Fit to Volume" rebalance |
| Additive carrier model | Volume = carrier volume target; essential oils add on top (matches aromatherapy practice) |
| Compatibility scoring | A–F grade per blend; EXCELLENT / GOOD / CAUTION / AVOID / UNSAFE per pair; carrier↔carrier, carrier↔EO, and EO↔EO pairings all score equally |
| Safety hard-blocks | UNSAFE combinations cannot be saved (validated client + server) |
| Per-oil dilution check | Warns when any EO exceeds its recommended max dilution at the chosen volume |
| Quantity calculator | ml per carrier, drops per essential oil; "Final mix" hint shows actual total |
| Oil compare tool | Side-by-side comparison of any two oils with compatibility verdict; persistent slot selection across navigation |
| Compatibility matrix | Sortable, searchable grid of every pairing in the library; drag-to-scroll on desktop, native pan on touch |
| Aromatherapy glossary | 42 common terms across therapeutic properties, carrier chemistry, and blending safety |
| PDF export | Downloadable recipe card with blend data and QR code, generated client-side |
| Shareable URLs | Persistent `/blend/[id]` URL for every saved blend |
| View tracking | Each blend page visit increments a view counter |
| Featured blends | Admin-curated blends shown on homepage and `/blends` listing |
| Auto-purge | Non-featured blends inactive for 30+ days are automatically deleted |
| Oil library | 55 oils (30 essential + 25 carrier) with botanical names, origins, benefits, contraindications |
| Oil catalogue | Searchable, filterable by type (carrier / essential) |
| Oil detail pages | Full profiles with all pairings listed; one-click add to blend or compare |
| Admin panel | Manage oils and blends without touching the database directly |

---

## Quick Start (Docker)

### 1. Get the compose file

Download `docker-compose.yml` from this repository, or clone the repo:

```bash
git clone https://github.com/tfindley/oil-blender.git
cd oil-blender
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
NEXT_PUBLIC_BASE_URL=https://your-domain.com
ADMIN_SECRET=your-strong-admin-password
CRON_SECRET=your-strong-cron-secret
```

### 3. Start

```bash
docker compose up -d
```

### 4. Seed the database

Database migrations run automatically on container startup. To load the built-in oil data:

```bash
docker compose exec app node scripts/seed.js
```

Open [http://localhost:3000](http://localhost:3000).

### Pre-built images

Images are published to the GitHub Container Registry on every tagged release:

```bash
docker pull ghcr.io/tfindley/oil-blender:latest
```

Specific version tags are also available — see [Releases](https://github.com/tfindley/oil-blender/releases).

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `NEXT_PUBLIC_BASE_URL` | Yes | — | Public URL of your deployment (used in QR codes and blend share links) |
| `ADMIN_SECRET` | Yes | — | Password for the admin panel at `/admin` |
| `CRON_SECRET` | Yes | — | Bearer token for the auto-purge endpoint |
| `NEXT_PUBLIC_SITE_NAME` | No | `Oil Blender` | Display name shown in the header, footer, page titles, and PDF |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | — | Google Analytics 4 measurement ID (`G-XXXXXXXXXX`); omit to disable |
| `ANTHROPIC_API_KEY` | No | — | Enables AI enrichment via the Admin → Database panel and `node scripts/enrich.js` |

---

## Admin Panel

The admin panel is at `/admin`, protected by `ADMIN_SECRET`.

### Oil management

`/admin` lists all oils. From here you can create new oils or edit existing ones (name, description, benefits, pairings, image URL, buy link, etc.).

### Database tools

`/admin/database` shows current oil, pairing, and blend counts with three sections:

- **Migrations** — shows whether the database schema is up to date; lists any pending migrations with SQL preview; one-click **Apply Pending Migrations** button with manual shell instruction fallback
- **Seed Database** — loads the built-in 55 oils and ~96 pairings; safe to re-run (all operations are upserts)
- **Enrich Oils with AI** — calls the Claude API to generate richer descriptions and a full pairing matrix; only shown when `ANTHROPIC_API_KEY` is set; runs as a background process; by default only processes oils that have never been enriched — use **Force re-enrich all** to override

### Blend management

`/admin/blends` lists all blends with view counts, grade, creation date, and feature flags. From here you can:
- Delete a single blend
- Select multiple blends and delete them in bulk
- Delete all non-featured blends in one action

### Promoting a blend to the showcase

1. Build a blend on the frontend and copy the URL (e.g. `https://your-domain.com/blend/clxxx…`)
2. Go to `/admin/blends/import`
3. Paste the URL or bare blend ID and click **Look up blend**
4. Fill in the author name and description, set the feature flags
5. Click **Promote blend** — the blend now appears on the homepage and `/blends` page

Feature flags:
- **Featured** — appears on the `/blends` listing and homepage carousel
- **Pinned** — sorted to the top of both pages
- **Hidden** — removed from all public pages (useful for drafts or takedowns)

---

## Auto-Purge

Non-featured blends that haven't been visited for 30 days are automatically deleted. Trigger via an authenticated HTTP endpoint.

### Endpoint

```
GET /api/cron/purge
Authorization: Bearer <CRON_SECRET>
```

Returns `{ "deleted": 3, "message": "Purged 3 inactive blend(s)" }`.

### Scheduling on the host

Pick whichever scheduler your host supports. Both run on the host and curl the endpoint exposed by the container — nothing extra needs to run inside the container.

#### Option A — systemd timer (recommended on modern Linux)

Create `/etc/systemd/system/oil-blender-purge.service`:

```ini
[Unit]
Description=Oil Blender auto-purge of inactive blends
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/srv/oil-blender/.env
ExecStart=/usr/bin/curl -sfS --max-time 60 -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/purge
```

Adjust `EnvironmentFile=` to the path of the `.env` that holds `CRON_SECRET`. If port 3000 isn't bound on the host (e.g. you front the container with Traefik only), replace `http://localhost:3000` with your public hostname.

Create `/etc/systemd/system/oil-blender-purge.timer`:

```ini
[Unit]
Description=Run Oil Blender auto-purge daily at 03:00

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
```

Enable and test:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now oil-blender-purge.timer
sudo systemctl list-timers oil-blender-purge.timer   # confirm scheduled
sudo systemctl start oil-blender-purge.service       # one-shot test run
sudo journalctl -u oil-blender-purge.service -n 30   # see result
```

A successful run shows `{"deleted":N,"message":"Purged N inactive blend(s)"}` in the logs.

#### Option B — classic cron

```cron
0 3 * * *  curl -sf -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/purge
```

If your host doesn't have a cron daemon, install one (`sudo apt install cron && sudo systemctl enable --now cron` on Debian/Ubuntu).

---

## Database Backups

The auto-purge keeps the database tidy; **backups** keep your data recoverable if something goes wrong. Postgres `pg_dump` is the standard tool. Two scheduling patterns below, depending on where the database lives.

Same shape as the auto-purge in either case: systemd timer + service.

### Option A — database is in a container alongside the app

Use `docker compose exec` to run `pg_dump` inside the database container; pipe the output to a file on the host.

`/etc/systemd/system/oil-blender-backup.service`:

```ini
[Unit]
Description=Oil Blender Postgres backup (containerised DB)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=/srv/oil-blender
ExecStart=/bin/sh -c 'docker compose exec -T db pg_dump -U oils -Fc oils > /var/backups/oil-blender/oils-$(date +%%Y-%%m-%%d).dump && find /var/backups/oil-blender -name "oils-*.dump" -mtime +14 -delete'
```

Adjust `WorkingDirectory=` to the directory holding your `docker-compose.yml`, and the `-U oils oils` arguments to match your DB user / database name. The `find … -mtime +14 -delete` rolls off backups older than 14 days; change the number to your preferred retention.

### Option B — database is external (managed Postgres, separate VPS, host install)

If the database isn't a Docker Compose service, you don't need `docker compose exec`. Use `pg_dump` directly with your `DATABASE_URL`. **This requires `postgresql-client` installed on the host** (`sudo apt install postgresql-client`).

`/etc/systemd/system/oil-blender-backup.service`:

```ini
[Unit]
Description=Oil Blender Postgres backup (external DB)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/srv/oil-blender/.env
ExecStart=/bin/sh -c 'pg_dump -Fc "$DATABASE_URL" -f /var/backups/oil-blender/oils-$(date +%%Y-%%m-%%d).dump && find /var/backups/oil-blender -name "oils-*.dump" -mtime +14 -delete'
```

This reads `DATABASE_URL` from the same `.env` your app uses, so credentials and host are picked up automatically.

### Either option — shared timer

`/etc/systemd/system/oil-blender-backup.timer`:

```ini
[Unit]
Description=Nightly Oil Blender Postgres backup at 02:30

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true
RandomizedDelaySec=900

[Install]
WantedBy=timers.target
```

Enable + smoke-test:

```bash
sudo mkdir -p /var/backups/oil-blender
sudo systemctl daemon-reload
sudo systemctl enable --now oil-blender-backup.timer
sudo systemctl start oil-blender-backup.service   # one-shot
sudo ls -lh /var/backups/oil-blender              # should see today's .dump
```

### Restore drill

Untested backups aren't backups. At least once, confirm a dump can be restored into a scratch database:

```bash
# Containerised DB:
docker compose exec -T db createdb -U oils oils_restore_test
cat /var/backups/oil-blender/oils-YYYY-MM-DD.dump | docker compose exec -T db pg_restore -U oils -d oils_restore_test -c
docker compose exec -T db dropdb -U oils oils_restore_test

# External DB:
createdb -h <host> -U oils oils_restore_test
pg_restore -h <host> -U oils -d oils_restore_test -c /var/backups/oil-blender/oils-YYYY-MM-DD.dump
dropdb -h <host> -U oils oils_restore_test
```

If `pg_restore` completes without errors, your backup is sound.

### Off-machine copies

A backup that lives only on the same VPS as the database is one disk failure away from gone. Push the dumps somewhere off-machine on a similar schedule — `rclone`, `restic`, `borg`, or a simple `aws s3 sync` cron all work. Cheapest: Backblaze B2 (~$0.005/GB/month) or Cloudflare R2 (free tier covers small sites).

### Migrating to a new host or domain

The backup/restore commands above cover same-host snapshots. Cross-host migration adds DNS, environment, and redirect concerns — see [docs/MIGRATION.md](docs/MIGRATION.md) for the step-by-step cutover runbook.

---

## Enriching Oil Data

The container includes a bundled enrichment script that calls the Anthropic Claude API to generate richer oil descriptions and a complete pairing matrix.

Set `ANTHROPIC_API_KEY` in your `.env` file, then trigger enrichment from the **Admin → Database** panel, or run it directly:

```bash
docker compose exec app node scripts/enrich.js
```

**By default the script only processes oils that have not yet been enriched** — this means re-running after a fresh seed is always safe and nearly free. To force re-enrichment of all oils (e.g. after a model upgrade):

```bash
docker compose exec -e FORCE_REENRICH=1 app node scripts/enrich.js
```

Approximate cost: ~$0.05–0.15 USD for a full run of all 55 oils.

---

## Analytics

Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` to your `G-XXXXXXXXXX` measurement ID to enable Google Analytics 4. Leave it unset or empty to disable — no tracking code is injected.

When enabled, GA collects standard anonymised usage data (pages visited, session duration, browser/device type, approximate location). Blend contents are never transmitted to Google.

---

## Branding Your Deployment

Set `NEXT_PUBLIC_SITE_NAME` to customise the display name shown in the header, footer, page titles, and PDF recipe cards. The About page will show a "Powered by Oil Blender" attribution linking back to this repository.

---

## AI & LLM Transparency

> **The oil data in this application was generated using [Claude](https://anthropic.com) (claude-sonnet-4-6) by Anthropic.**

The enrichment pipeline calls the Claude API to generate botanical descriptions, historical context, benefit profiles, and compatibility ratings.

The application code was also built with AI assistance (Claude Code / Anthropic Claude).

The **UNSAFE pairing list** is hand-curated by the developer and cross-referenced against established aromatherapy safety literature — it is not AI-generated.

⚠️ AI-generated content can contain errors. This information is for general guidance only and does not replace professional aromatherapy or medical advice.

---

## Development

For local development from source, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Contributing

Issues and PRs welcome at [github.com/tfindley/oil-blender](https://github.com/tfindley/oil-blender/issues).

Safety corrections (incorrect ratings, missing UNSAFE pairs, wrong contraindications) are the highest priority.

---

## Support

☕ [ko-fi.com/tfindley](https://ko-fi.com/tfindley)

---

## Disclaimer

The information on this site is for educational and general wellness purposes only. It is not medical advice. Essential oils are potent — always patch test, keep out of reach of children, and consult a qualified professional if pregnant, nursing, or managing a health condition.

---

## License

MIT — see [LICENSE](LICENSE).
