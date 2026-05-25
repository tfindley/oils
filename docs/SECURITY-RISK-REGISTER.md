# Security Risk Register

Triage of vulnerabilities reported by container scanners (Grype, Trivy, Dependabot) for `ghcr.io/tfindley/oil-blender`. The goal is to record, for each finding, **where it lives** and **whether it is actually reachable from our app's runtime** — so we can distinguish CVEs that need urgent action from those that are vendored inside upstream tooling we don't control.

**Last reviewed:** 2026-05-25 against `v0.2.3` image
**Last remediation:** `v0.2.4` (2026-05-25) — npm overrides for 7 transitive deps + Docker base bump (`node:20-alpine` → `node:22-alpine`)
**Source reports:**
- 2026-05-25: [docs/security/vuln-report-ghcr.io-tfindley-oil-blender-latest-grype-2026-05-25.json](./security/vuln-report-ghcr.io-tfindley-oil-blender-latest-grype-2026-05-25.json) — pre-v0.2.4
- 2026-05-06: [docs/vuln-report-ghcr.io-tfindley-oil-blender-latest-grype-2026-05-06.json](./vuln-report-ghcr.io-tfindley-oil-blender-latest-grype-2026-05-06.json) — pre-v0.1.4 (original)

## Status summary

18 findings on the 2026-05-25 scan: 11 high, 5 medium, 2 low, 0 critical. **Zero are exploitable from our running application.**

`v0.2.4` (shipped 2026-05-25) applies the maximum non-breaking patches available without a Next.js framework upgrade:

| Category | Findings | v0.2.4 result |
|---|---|---|
| Alpine base image (BusyBox) | 3 | **Fixed** — `node:22-alpine` ships newer BusyBox |
| Prisma engine tooling (`ip-address`) | 1 | **Fixed** — npm override to `^10.1.1` |
| Non-vendored Next/Prisma transitives (`minimatch`, `brace-expansion`, `diff`) | 6 | **Fixed** — npm overrides |
| Vendored inside Next.js compiled dist (`tar`, `glob`, `cross-spawn`) | 8 | **Carried over** — Next.js bundles its own pre-compiled copies inside `next/dist/compiled/*`; `npm overrides` cannot replace them. Awaiting upstream Next.js bump. |

**Expected post-`v0.2.4` count:** ~8 findings (all `next/dist/compiled/*` vendored — tar × 6, glob × 1, cross-spawn × 1). All in build-tooling utilities that are present-in-image but **not loaded at runtime by app code**.

A fresh Grype scan should be run after `v0.2.4` lands on `:latest` to verify the actual count.

## Triage policy

- **Reachable from app code AND fixable** → fix immediately
- **Not reachable but fixable cheaply** → fix as cosmetic cleanup *(v0.2.4 batch did this)*
- **Vendored upstream / not reachable** → record here; re-evaluate on Next.js / Prisma / Alpine upgrade
- **Reachable but not fixable** (none today) → mitigate via input validation or feature gating

---

## ✅ Fixed in v0.2.4

### Alpine BusyBox — CVE-2025-60876 (3 findings, medium)

[CVE-2025-60876](https://nvd.nist.gov/vuln/detail/CVE-2025-60876) — BusyBox `wget` accepts raw CR/LF in the request-target, allowing HTTP request smuggling / header injection. Reported three times in the SBOM (once each for `busybox`, `busybox-binsh`, `ssl_client`) — same package, different applets.

**Reachable from app?** No. `docker-entrypoint.sh` does not invoke `wget`. Container runs as a non-root user (`nextjs`, uid 1001) with no shell exposed to the network.

**v0.2.4 fix:** bumped `Dockerfile` base from `node:20-alpine` to `node:22-alpine`. The newer Alpine layer (3.21+) ships patched BusyBox (1.37.0-r34 or later).

### ip-address 9.0.5 → ^10.1.1 (1 finding, medium)

[GHSA-v2v4-37r5-5v8g](https://github.com/advisories/GHSA-v2v4-37r5-5v8g) — XSS in `Address6` HTML-emitting methods.

**Reachable from app?** No. Our app code never imports `ip-address`; the library is deep in Prisma's proxy-agent chain for engine downloads, not runtime output.

**v0.2.4 fix:** `package.json` override pinning `ip-address: "^10.1.1"`. v9→v10 is a major API change, but Prisma's usage path (proxy agent) appears unaffected. `npm install` succeeded; `npx tsc --noEmit` and `npm run build` clean.

### minimatch 9.0.5 → ^9.0.7 (3 findings, all high)

| ID | Issue |
|---|---|
| [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | ReDoS via combinatorial backtracking with multiple non-adjacent `**` segments |
| [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | ReDoS via repeated wildcards with non-matching literal |
| [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | ReDoS via nested `*()` extglobs |

**Reachable from app?** No. App code does not invoke `minimatch` with user-supplied patterns. Used by Next.js / Prisma for build-time glob matching.

**v0.2.4 fix:** `package.json` override. `minimatch` is NOT vendored inside `next/dist/compiled/`, so the override cascades.

### brace-expansion 2.0.1 → ^2.0.3 (2 findings)

| ID | Severity | Issue |
|---|---|---|
| [GHSA-v6h2-p8h4-qcjw](https://github.com/advisories/GHSA-v6h2-p8h4-qcjw) | low | ReDoS |
| [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | medium | Zero-step sequence causes process hang and memory exhaustion |

**Reachable from app?** No. Used internally by glob/minimatch for brace expansion.

**v0.2.4 fix:** `package.json` override. Not vendored by Next.js.

### diff 5.2.0 → ^5.2.2 (1 finding, low)

[GHSA-73rr-hh4g-fpgx](https://github.com/advisories/GHSA-73rr-hh4g-fpgx) — DoS in `parsePatch`/`applyPatch` with malformed input.

**Reachable from app?** No. We don't apply patches at runtime. Pulled in by Prisma CLI tooling during engine installation.

**v0.2.4 fix:** `package.json` override.

---

## ⏸️ Carried — vendored inside `next/dist/compiled/*`

These packages ship pre-bundled inside the Next.js distribution. `npm overrides` **cannot** replace them — they're inlined into Next's compiled JavaScript bundles. Verified against `next@16.2.6`:

```
node_modules/next/dist/compiled/
├── tar/         # still vendored
├── glob/        # still vendored
├── cross-spawn/ # still vendored
└── ...140+ others
```

Resolution requires upstream Next.js to bump its bundled dependency versions, then we upgrade Next.js. **Tracked here, not fixed.**

### node-tar 6.2.1 — 6 findings (all high, vendored)

| ID | Issue |
|---|---|
| [GHSA-34x7-hfp2-rc4v](https://github.com/advisories/GHSA-34x7-hfp2-rc4v) | Arbitrary File Creation/Overwrite via Hardlink Path Traversal |
| [GHSA-r6q2-hw4h-h46w](https://github.com/advisories/GHSA-r6q2-hw4h-h46w) | Race Condition in Path Reservations via Unicode Ligature Collisions on macOS APFS |
| [GHSA-9ppj-qmqm-q256](https://github.com/advisories/GHSA-9ppj-qmqm-q256) | Symlink Path Traversal via Drive-Relative Linkpath |
| [GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96) | Hardlink Path Traversal via Drive-Relative Linkpath |
| [GHSA-83g3-92jg-28cx](https://github.com/advisories/GHSA-83g3-92jg-28cx) | Arbitrary File Read/Write via Hardlink Target Escape |
| [GHSA-8qq5-rm4j-mr97](https://github.com/advisories/GHSA-8qq5-rm4j-mr97) | Arbitrary File Overwrite via Insufficient Path Sanitization |

**Reachable from app?** No. Our app does not extract tar archives at runtime. `tar` is bundled into `next/dist/compiled/tar/` because Next.js uses it for asset packaging during build/install. Container scanners detect it via file signature, not because the runtime loads it.

**v0.2.4 attempted fix:** `package.json` override to `^7.5.11`. Patches the top-level `node_modules/tar` but **does not affect `next/dist/compiled/tar/`**. Expected to remain in next Grype scan.

**Real remediation:** await Next.js bumping its bundled `tar` to 7.5.x, then upgrade Next.js. No upstream tracking issue identified.

### glob 10.4.2 — 1 finding (high, vendored)

[GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) — Command injection via `glob -c/--cmd` flag (the CLI executable, not the library API).

**Reachable from app?** No. We never invoke the `glob` CLI.

**v0.2.4 attempted fix:** override to `^10.5.0`. Likely still flagged from `next/dist/compiled/glob/`.

### cross-spawn 7.0.3 — 1 finding (high, vendored)

[GHSA-3xgq-45jj-v275](https://github.com/advisories/GHSA-3xgq-45jj-v275) — ReDoS in shebang parsing.

**Reachable from app?** Effectively no. Our runtime app code does not call `child_process.spawn` with user input.

**v0.2.4 attempted fix:** override to `^7.0.5`. Likely still flagged from `next/dist/compiled/cross-spawn/`.

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
