# Security Risk Register

Triage of vulnerabilities reported by container scanners (Grype, Trivy, Dependabot) for `ghcr.io/tfindley/oil-blender`. The goal is to record, for each finding, **where it lives** and **whether it is actually reachable from our app's runtime** — so we can distinguish CVEs that need urgent action from those vendored inside upstream tooling we don't control.

**Last reviewed:** 2026-05-26 against `v0.2.4` image
**Last remediation:** `v0.2.4` (2026-05-25) — npm overrides for 7 transitive deps + Docker base bump (`node:20-alpine` → `node:22-alpine`)

**Source reports** (newest first):

| Date | Image | Findings | Report |
|---|---|---|---|
| 2026-05-26 | `v0.2.4` (post-fix) | **7** (1 H / 6 M / 0 L) | [docs/security/…2026-05-26.json](./security/vuln-report-ghcr.io-tfindley-oil-blender-latest-grype-2026-05-26.json) |
| 2026-05-25 | `v0.2.3` (pre-fix) | 18 (11 H / 5 M / 2 L) | [docs/security/…2026-05-25.json](./security/vuln-report-ghcr.io-tfindley-oil-blender-latest-grype-2026-05-25.json) |
| 2026-05-06 | `v0.1.4` (historical) | 18 | [docs/security/…2026-05-06.json](./security/vuln-report-ghcr.io-tfindley-oil-blender-latest-grype-2026-05-06.json) |
| 2026-05-04 | original baseline | — | [docs/security/…2026-05-04.json](./security/vuln-report-ghcr.io-tfindley-oil-blender-latest-grype-2026-05-04.json) |

## Status summary

**v0.2.4 reduced findings from 18 → 7.** **Zero are exploitable from our running application.** All remaining are vendored or bundled deeper in the image than `npm overrides` can reach.

| Category | Count | Status |
|---|---|---|
| Alpine base image (BusyBox) | 3 | **Carried** — `node:22-alpine` still on BusyBox 1.37.0-r30; awaiting Alpine repo to publish the patched build |
| Vendored inside Next.js compiled dist (`picomatch`) | 2 | **Carried** — `next/dist/compiled/picomatch` is pre-bundled; npm overrides cannot replace it. Awaits upstream Next.js bump. |
| Bundled inside Prisma engines / similar binaries (`brace-expansion`, `ip-address`) | 2 | **Carried** — Grype's signature detection finds older copies inside compiled blobs; not in our `node_modules` tree at all (we have `brace-expansion@2.1.1` and no top-level `ip-address`). Awaits upstream binary refresh. |

**The 11 high-severity findings fixed in v0.2.4 stay fixed.** No regressions.

## Triage policy

- **Reachable from app code AND fixable** → fix immediately
- **Not reachable but fixable cheaply** → fix as cosmetic cleanup *(done in v0.2.4)*
- **Vendored upstream / not reachable** → record here; re-evaluate on Next.js / Prisma / Alpine upgrade
- **Reachable but not fixable** (none today) → mitigate via input validation or feature gating

---

## ⏸️ Carried — Alpine base image (BusyBox)

### busybox 1.37.0-r30 — 3 findings (all medium, same CVE)

[CVE-2025-60876](https://nvd.nist.gov/vuln/detail/CVE-2025-60876) — BusyBox `wget` accepts raw CR/LF in the request-target, allowing HTTP request smuggling / header injection. Reported three times (once each for `busybox`, `busybox-binsh`, `ssl_client`).

**Reachable from app?** No. `docker-entrypoint.sh` does not invoke `wget`. Container runs as a non-root user (`nextjs`, uid 1001) with no shell exposed to the network.

**v0.2.4 attempted fix:** bumped `Dockerfile` base from `node:20-alpine` to `node:22-alpine`, expecting the newer Alpine layer to ship patched BusyBox. **Did not land** — `node:22-alpine` still pulls Alpine 3.21 packages, which haven't yet shipped the patched BusyBox build (expected in `1.37.0-r34` or later when Alpine cuts the next point release).

**Real remediation:**
1. **Wait** for Alpine to publish the patched BusyBox in the repo that `node:22-alpine` pulls from. This happens on its own and our `apk upgrade --no-cache` in the runner stage will pick it up automatically on the next image build.
2. **Or explicitly pin** to a future `node:22-alpine3.NN` once Alpine publishes the patched release.

---

## ⏸️ Carried — vendored inside `next/dist/compiled/*`

These packages ship pre-bundled inside the Next.js distribution. `npm overrides` cannot replace them — they're inlined into Next's compiled JavaScript. Verified against `next@16.2.6`:

```
node_modules/next/dist/compiled/
├── picomatch/   # <-- this scan's residual
└── ...148 others
```

Resolution requires upstream Next.js to bump its bundled dependency versions, then we upgrade Next.js.

### picomatch 4.0.3 — 2 findings (1 high, 1 medium)

| ID | Severity | Issue |
|---|---|---|
| [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | high | ReDoS via extglob quantifiers |
| [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) | medium | Method Injection in POSIX Character Classes causing incorrect glob matching |

**Reachable from app?** No. Our app does not invoke picomatch with user-supplied patterns. Used by Next.js for build-time glob matching of routes and assets.

**v0.2.4 attempted fix:** none — these advisories were published after the v0.2.4 fix was prepared. The picomatch in our own `node_modules` is at 4.0.4 (patched) via tinyglobby's transitive update; the version Grype detects is the older copy at `next/dist/compiled/picomatch/index.js`.

**Real remediation:** await Next.js to bump bundled `picomatch` to 4.0.4+. Could add `"picomatch": "^4.0.4"` to overrides for completeness even though it won't reach the vendored copy.

---

## ⏸️ Carried — bundled inside compiled binaries

Grype's signature-based detection finds older copies of these packages inside compiled JavaScript / binary blobs in the image — likely Prisma engine bundles or similar pre-compiled artefacts. These aren't in our top-level `node_modules` tree at all, so `npm overrides` have no effect.

### brace-expansion 2.0.2 — 1 finding (medium)

[GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) — Zero-step sequence causes process hang and memory exhaustion.

**Reachable from app?** No.

**v0.2.4 attempted fix:** override to `^2.0.3`. Top-level `node_modules/brace-expansion` is now at 2.1.1 (patched). Grype is detecting 2.0.2 in some other in-image location — most likely a compiled artefact (Prisma engine bundle, esbuild dist, or similar).

**Real remediation:** await the upstream tool that bundles this copy to refresh.

### ip-address 10.1.0 — 1 finding (medium)

[GHSA-v2v4-37r5-5v8g](https://github.com/advisories/GHSA-v2v4-37r5-5v8g) — XSS in `Address6` HTML-emitting methods.

**Reachable from app?** No. Used internally by Prisma's network handling; never HTML-rendered.

**v0.2.4 attempted fix:** override to `^10.1.1`. `ip-address` is no longer in our `node_modules` tree at all (Prisma may have dropped the direct dependency). Grype is detecting 10.1.0 in a compiled binary blob in the image.

**Real remediation:** await Prisma's bundled binaries to refresh.

---

## Re-evaluation

Re-run the scanner and update this document:

- After each Next.js minor/patch upgrade (especially major bumps — those are when vendored deps refresh)
- After each Prisma upgrade
- After any base-image change
- At least quarterly even with no upgrades

To regenerate the underlying report:

```bash
grype ghcr.io/tfindley/oil-blender:latest -o json > docs/security/vuln-report-ghcr.io-tfindley-oil-blender-latest-grype-$(date +%Y-%m-%d).json
```
