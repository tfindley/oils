# Site Migration

How to move an Oil Blender deployment to a new host, a new domain, or both. The valuable piece is the database — everything else (app image, configuration, infrastructure) is replayable.

This is **not** a regular backup procedure — for that, see the "Database Backups" section of the [README](../README.md). This doc covers the *cross-host cutover* sequence.

## Scenarios this covers

- **Same host, new domain** — keep the database in place; just point a new domain at it and update `NEXT_PUBLIC_BASE_URL`.
- **New host, same domain** — `pg_dump` → transfer → `pg_restore` → DNS swap.
- **New host AND new domain** — both of the above combined. Most common when migrating a hobby/test deployment to a permanent one.

## What stays the same after migration

- **Blend IDs are Prisma cuids** (DB-internal). They do not encode the domain. After restore, every saved blend works at `https://newdomain.com/blend/<same-id>`.
- **Oil IDs, oil data, pairings, settings** — all internal to the database; survive a `pg_dump` round-trip cleanly.
- **Admin and cron secrets** — environment variables on the host. Carry whichever values you want, or generate new ones during the cutover.

## What can break if you skip steps

- **Share links from the old domain go dead** unless you set up a 301 redirect from old domain to new (see step 7).
- **PDF QR codes downloaded before the migration** embed the share URL at the moment of generation, so they point at the old domain. Same redirect mitigates this.
- **`admin_token` cookies issued by the old host** become invalid as soon as `ADMIN_SECRET` rotates (the HMAC signature uses the secret) — admin re-login is required. Trivial; mention it so it's not a surprise.

---

## Pre-flight

Before starting, confirm on the **new host**:

- Docker + Docker Compose installed and working.
- Postgres major version matches the old host (`pg_dump --version` on both sides should agree at least to the major version — Postgres 16 → 16, etc.). Mismatched majors are a separate problem; do a Postgres upgrade on one side first if needed.
- Either:
  - **Containerised DB**: a copy of your `docker-compose.yml` ready to bring up. The DB service is empty for now — restore will populate it.
  - **External / managed DB**: an empty target database created, and `DATABASE_URL` known.
- A valid TLS certificate is provisioned for the new domain (Let's Encrypt via Traefik/Caddy, or your provider's equivalent). The cookie auth uses `secure: true` in production, which silently fails over plain HTTP.

## Steps

### 1. Reduce DNS TTL (optional but recommended)

A day or two before the cutover, drop the TTL on the DNS record for the old domain to something short (300s). This speeds up the eventual DNS swap. If you skip this, expect propagation to take whatever your current TTL is (often 1–24 hours).

### 2. Stop writes on the old deployment

Cleanest cutover. Either:

- Put the old site into a read-only mode if you have one, or
- Stop the app service: `docker compose stop app` on the old host (DB stays running; you'll dump from it in the next step).
- Or accept a small window of lost writes — any blend saved on the old host between dump and cutover won't appear on the new host.

### 3. Take a final dump from the old database

**Containerised DB:**

```bash
docker compose exec -T db pg_dump -U oils -Fc oils > /tmp/oils-final.dump
```

**External / managed DB:**

```bash
pg_dump -Fc "$DATABASE_URL" -f /tmp/oils-final.dump
```

`-Fc` (custom format) is preferred over plain SQL — parallel restore, selective restore, and compact size. The file is binary; don't try to `cat` it.

Sanity-check the file size — it should be at least a few MB for a non-trivial dataset. A near-empty dump file means something failed silently.

### 4. Transfer the dump to the new host

Whatever you trust:

```bash
scp /tmp/oils-final.dump user@new-host:/tmp/
```

Or via your off-machine backup (Backblaze, R2, etc.) if you've set that up already.

### 5. Restore on the new host

**Containerised DB** (DB service running, app service not yet started):

```bash
# Start just the DB service from the new compose file
docker compose up -d db

# Wait for it to become healthy:
docker compose ps

# Restore. --no-owner --no-privileges avoids permission errors when DB users
# differ between the old and new hosts. -c drops/recreates objects so this works
# against an empty target.
cat /tmp/oils-final.dump | docker compose exec -T db pg_restore -U oils -d oils --no-owner --no-privileges -c --if-exists
```

**External / managed DB:**

```bash
pg_restore -d "$DATABASE_URL" --no-owner --no-privileges -c --if-exists /tmp/oils-final.dump
```

You may see a handful of "errors ignored on restore" notices from `pg_restore` related to dropping objects that didn't exist yet in the empty target — those are expected with `-c --if-exists` and harmless.

### 6. Bring up the app on the new host

Set the env on the new host. Critical ones to review:

| Variable | What to set |
|---|---|
| `DATABASE_URL` | Point at the new DB |
| `NEXT_PUBLIC_BASE_URL` | The **new** public URL (`https://newdomain.com`). Used in PDF QR codes and the share-URL shown on the blend detail page |
| `ADMIN_SECRET` | Either copy from the old host or rotate. If rotated, you re-login once |
| `CRON_SECRET` | Same — copy or rotate |
| `NEXT_PUBLIC_SITE_NAME` | If you've changed branding, this changes the header / footer / page titles / PDF |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | If you want analytics continuity in the same property, copy; if you want a clean slate, create a fresh GA4 property and use its ID. Either is fine — choice is about historical-data continuity |
| `ANTHROPIC_API_KEY` | Only needed if you'll run AI enrichment from the new host |

Bring up the full stack:

```bash
docker compose up -d
```

Migrations run automatically on container startup via `scripts/migrate.js`. Since you just restored a full schema, expect a "no pending migrations" log line — the dump included the migration history.

### 7. Confirm the new site works *before* swapping DNS

Hit the new host's public URL (or a `--resolve` curl against its IP) and walk through:

- Homepage loads, featured blends count matches the old site
- `/oils` loads, full oil library visible
- `/admin/login` works with your `ADMIN_SECRET`
- Save a test blend → confirm it appears in `/admin/blends`
- Download the PDF for a saved blend → confirm the QR code now points at the **new** domain

If anything fails, fix it on the new host before going further. The old domain is still serving the old DB.

### 8. Swap DNS

Update the A/AAAA records (or CNAME) for the new domain. Wait for propagation — `dig +short newdomain.com` from a couple of machines confirms it's live.

If you reduced TTL in step 1, propagation should take minutes. Otherwise it could be hours.

### 9. Set up redirect on the old domain

Anyone who has bookmarked, shared, or printed a PDF for `oldsite.com/blend/<id>` now hits a dead URL unless you redirect.

**Traefik** — add to the old domain's router config:

```yaml
middlewares:
  redirect-to-new:
    redirectRegex:
      regex: "^https?://oldsite\\.com/(.*)"
      replacement: "https://newdomain.com/${1}"
      permanent: true
```

**nginx** on the old host:

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name oldsite.com;
    return 301 https://newdomain.com$request_uri;
}
```

**Cloudflare**: page-rules redirect (1 free rule per zone covers this) or a redirect rule with regex.

Keep the redirect alive for **at least 60 days** to cover:

- The 30-day blend auto-purge window (blends created on the old site may still be active for that long).
- Search engine indexes.
- Any external references you haven't tracked.

### 10. Move the cron jobs to the new host

If you set up systemd timers per the [README's Backups section](../README.md#database-backups), repeat the setup on the new host:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now oil-blender-purge.timer
sudo systemctl enable --now oil-blender-backup.timer
```

**And disable them on the old host** so they don't keep firing against an offline (or worse, still-routable-via-DNS-cache) old URL:

```bash
sudo systemctl disable --now oil-blender-purge.timer
sudo systemctl disable --now oil-blender-backup.timer
```

### 11. Update Google Analytics (if applicable)

In the GA4 property:

- **Continuity**: change the property's reporting URL from old domain to new. Existing event history stays attached to the same property.
- **Clean slate**: create a new GA4 property, take its measurement ID, update `NEXT_PUBLIC_GA_MEASUREMENT_ID` on the new host.

Either is fine — the choice is about whether you want historical data and the new traffic in the same view.

### 12. Decommission

Once you've confirmed the new site is stable (give it a week of real traffic to be safe) and the redirect is in place:

- Tear down the old app container.
- Keep the old DB **as a cold backup** for at least 30 days — don't delete it the day of the migration.
- After 60 days, decommission the old host entirely if you still want to.

---

## Common gotchas

- **Mismatched Postgres majors** between old and new hosts cause `pg_restore` to fail or emit confusing errors. Either upgrade Postgres on the old host before the dump, or use the newer host's `pg_dump` over the network against the old DB (it's backwards-compatible the other way).
- **`secure: true` cookies silently fail over HTTP.** The admin login appears to "succeed" but the cookie never sets, and the next request 302s back to `/admin/login`. The fix is always "your TLS isn't actually working on the new domain yet."
- **Forgetting to update `NEXT_PUBLIC_BASE_URL`** — the app still works but PDF QR codes and explicit share URLs continue pointing at the old domain.
- **Skipping the redirect setup** — blends saved on the old site become unreachable from any external link. The 30-day auto-purge means they're permanently lost as soon as the old DB is decommissioned.
- **DNS cache surprises** — even with low TTL, some clients (corporate DNS, mobile carrier DNS) may keep the old IP cached for longer. The redirect on the old host catches them.

## Rollback

If something goes badly wrong during cutover and you need to abort:

1. **DNS revert** — point the domain back at the old host. This is the fastest reversal; everything below depends on it.
2. **Old host is still running** if you followed step 2 cleanly (you stopped the app but not the DB). Restart the app: `docker compose start app`.
3. **New host's data** since cutover is now orphaned — any writes there won't be on the old DB. Decide whether to dump it back across or accept the loss.
4. **Redirect** on the old host (step 9): take it down. Otherwise traffic that already saw the redirect will keep bouncing to the broken new domain.

Rollback is much cleaner if you keep the old host fully intact (just the app stopped) until you've decided the cutover is successful. **Don't decommission anything for at least a week after the cutover.**
