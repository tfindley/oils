import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import pkg from '@/package.json'

export const metadata = {
  title: 'About',
  description: 'About this massage oil blend builder — compatibility scoring, safety guidance, and printable recipe cards.',
}

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Oil Blender'
const isCustomName = siteName !== 'Oil Blender'
const version = pkg.version

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10">
        <div className="mb-3 text-4xl">🌿</div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-serif text-4xl font-bold text-stone-900 dark:text-stone-100">About {siteName}</h1>
          <a
            href={`https://github.com/tfindley/oil-blender/releases/tag/v${version}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm text-stone-400 hover:text-amber-700 dark:text-stone-500 dark:hover:text-amber-500"
            title={`View v${version} release notes`}
          >
            v{version}
          </a>
        </div>
        {isCustomName && (
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Powered by{' '}
            <a
              href="https://github.com/tfindley/oil-blender"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-amber-700 hover:underline dark:text-amber-500"
            >
              Oil Blender
            </a>
            {' '}— open-source massage oil blend builder
          </p>
        )}
        <p className="mt-3 text-lg text-stone-600 dark:text-stone-400">
          A free, open-source tool for building custom massage oil blends with real-time compatibility scoring, safety guidance, and printable recipe cards.
        </p>
      </div>

      {/* Purpose */}
      <section className="mb-10">
        <h2 className="mb-4 font-serif text-2xl font-semibold text-stone-800 dark:text-stone-200">What Is This?</h2>
        <div className="space-y-3 text-stone-700 dark:text-stone-300">
          <p>
            <a href="https://github.com/tfindley/oil-blender" target="_blank" rel="noopener noreferrer" className="font-medium text-amber-700 hover:underline dark:text-amber-500">Oil Blender</a>{' '}
            was built to make aromatherapy blending accessible, safe, and informed. Whether
            you&apos;re a professional massage therapist formulating client blends, or someone creating a relaxing oil
            for personal use, the tool walks you through choosing a carrier oil, adding essential oils, and understanding
            how they interact — all before you mix a single drop.
          </p>
          <p>
            The compatibility scoring system rates each oil pair as <strong>Excellent</strong>, <strong>Good</strong>,{' '}
            <strong>Caution</strong>, <strong>Avoid</strong>, or <strong>Unsafe</strong>, giving you the context
            you need to blend with confidence. Genuinely dangerous combinations are hard-blocked. Everything else is
            informative, not restrictive.
          </p>
          <p>
            Every blend gets a permanent shareable URL and a downloadable PDF recipe card with exact quantities,
            oil profiles, and pairing notes — useful for both personal records and client handouts.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mb-10">
        <h2 className="mb-4 font-serif text-2xl font-semibold text-stone-800 dark:text-stone-200">Features</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            'Tabbed blend builder: Carriers / Essentials / Quantities / Save',
            'In-progress blend persists across pages and reloads',
            'Header blend cart with live A–F grade from any page',
            'Multi-carrier blending (up to 5) with ml-based input',
            'Up to 5 essential oils per blend, measured in drops',
            'Additive carrier model — Volume = carrier amount, EOs add on top',
            'A–F compatibility grade including carrier↔carrier pairings',
            'EXCELLENT / GOOD / CAUTION / AVOID / UNSAFE pairing system',
            'Hard blocks for genuinely dangerous combinations',
            'Per-oil max-dilution safety warnings',
            '30 essential oils + 25 carrier oils in the library',
            'Aromatherapy glossary covering 42 common terms',
            'Side-by-side oil comparison tool',
            'Compatibility matrix with drag-to-scroll',
            'Dilution rate guidance (1–5%)',
            'Batch volume presets (10–200ml) with proportional rescale',
            'Persistent shareable blend URLs',
            'PDF recipe card with QR code download',
            'Per-oil profiles: benefits, origins, contraindications',
            'Searchable, filterable oil catalog',
            'Curated featured blends from the community',
            'Optional user accounts with email + password sign-in',
            'Display-name picker — show your full name, initials, a nickname, or Anonymous',
            'Per-blend privacy: every saved blend you own can be public or private',
            'Claim flow — link a previously-saved anonymous blend to your account',
            'My Blends page for everything you’ve saved',
            'Personal oil collection — track what you own (quantity, opened-on, expiry, supplier, cost)',
            '"From my collection" filter in the blend builder — only see oils you actually have',
            'Per-recipe shopping list — see which oils you need to buy at a glance',
            'Expiry warnings so you know which bottles to use up first',
          ].map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-stone-700 dark:text-stone-300">
              <span className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-500">✓</span>
              {f}
            </li>
          ))}
        </ul>
      </section>

      {/* AI Transparency */}
      <Card id="ai" className="mb-10 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50">
        <CardHeader>
          <h2 className="font-serif text-xl font-semibold text-amber-900 dark:text-amber-300">AI &amp; LLM Transparency</h2>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-amber-900 dark:text-amber-200">
          <p>
            <strong>The oil data in this application was generated using Claude (claude-sonnet-4-6), Anthropic&apos;s AI
            assistant.</strong> This includes botanical descriptions, historical context, benefit profiles,
            contraindications, and pairing compatibility ratings.
          </p>
          <p>
            While Claude&apos;s knowledge of aromatherapy is drawn from reputable sources, <strong>AI-generated content
            can contain errors</strong>. The compatibility ratings and safety information are for general guidance only
            and should not replace consultation with a qualified aromatherapist or healthcare professional.
          </p>
          <p>
            The <strong>UNSAFE pairing list</strong> is hand-curated by the developer and cross-referenced against
            established aromatherapy safety literature — it is not AI-generated.
          </p>
          <p>
            Additionally, <strong>the application itself was built with AI assistance</strong> (Claude Code / Anthropic
            Claude) for code generation, architecture, and development.
          </p>
          <p className="font-medium">
            Always patch test. Always consult a professional for therapeutic use. Not medical advice.
          </p>
        </CardBody>
      </Card>

      {/* Data Storage */}
      <section className="mb-10">
        <h2 className="mb-4 font-serif text-2xl font-semibold text-stone-800 dark:text-stone-200">Your Data &amp; Privacy</h2>
        <div className="space-y-4">
          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
            <h3 className="mb-2 font-semibold text-stone-800 dark:text-stone-200">Saving without an account</h3>
            <div className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
              <p>
                You can save a blend without signing up. When you do, the following gets written to the database:
                the oils you selected, their quantities and percentages, the blend name, creation timestamp,
                and view count. <strong>No login or personal information is required</strong> — the only thing
                linking you to the blend is its URL.
              </p>
              <p>
                Anonymous blend data is <strong>automatically deleted after 30 days of inactivity</strong> (last time
                the blend URL was visited). Blends an admin has promoted to the curated showcase are kept indefinitely.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
            <h3 className="mb-2 font-semibold text-stone-800 dark:text-stone-200">Saving with an account</h3>
            <div className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
              <p>
                If you sign up, we store your email, an argon2 hash of your password, your first and last name,
                your chosen display name (which can be <em>Anonymous</em>), and the date you last signed in.
                Your blends become attached to your account and remain available in <strong>My Blends</strong> for
                the lifetime of the account.
              </p>
              <p>
                <strong>Each of your blends is private by default.</strong> You decide which ones to share by
                flipping the share toggle on the blend page. Private blends are hidden from the public listings,
                the homepage, and the API — only you can see them.
              </p>
              <p>
                <strong>Account lifecycle.</strong> If you don&apos;t sign in for nearly a year, we email you a 14-day
                warning then a 3-day warning. Signing in any time during that window resets the clock. If you
                still don&apos;t sign in, the account and its data are deleted; any blends you marked shared remain
                accessible via their URLs as anonymous blends for up to 30 more days before they too are auto-removed.
              </p>
              <p>
                <strong>You can delete your account at any time</strong> from the <code className="font-mono">/account</code>
                page. Deletion cascades: sessions and provider links are dropped immediately; saved blends become
                anonymous so their URLs keep working (subject to the 30-day anonymous purge thereafter).
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
            <h3 className="mb-2 font-semibold text-stone-800 dark:text-stone-200">Abuse prevention</h3>
            <div className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
              <p>
                To prevent automated abuse, your IP address is briefly held in process memory when
                you save a blend or attempt to log in to the admin area, against a per-minute rate
                limit. The address is <strong>never written to disk</strong>, never logged, and
                never shared with third parties. The in-memory store is cleared on every server
                restart and stale entries drop out within an hour.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
            <h3 className="mb-2 font-semibold text-stone-800 dark:text-stone-200">Analytics</h3>
            <div className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
              <p>
                This site may use <strong>Google Analytics 4</strong> to collect anonymised usage statistics —
                pages visited, session duration, browser and device type, and approximate location (country or
                region). This helps understand which features are useful and how the site is being used.
              </p>
              <p>
                <strong>Blend contents and recipe data are never sent to Google.</strong> Analytics data is
                aggregated and anonymised. No personally identifiable information is transmitted.
              </p>
              <p>
                If you prefer not to be tracked, you can install the{' '}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-amber-700 hover:underline dark:text-amber-500"
                >
                  Google Analytics Opt-out Browser Add-on
                </a>
                , use a content-blocking browser extension (uBlock Origin, Privacy Badger, etc.), or enable
                &ldquo;Do Not Track&rdquo; in your browser settings.
              </p>
              <p className="text-xs text-stone-400 dark:text-stone-500">
                Analytics may not be enabled on all deployments of this open-source project. Self-hosted
                instances can omit the <code className="font-mono">NEXT_PUBLIC_GA_MEASUREMENT_ID</code> environment
                variable to disable it entirely.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="mb-10">
        <h2 className="mb-4 font-serif text-2xl font-semibold text-stone-800 dark:text-stone-200">Tech Stack</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { name: 'Next.js 16', role: 'Framework (App Router, TypeScript)', url: 'https://nextjs.org' },
            { name: 'PostgreSQL 16', role: 'Database', url: 'https://postgresql.org' },
            { name: 'Prisma 7', role: 'ORM and database migrations', url: 'https://prisma.io' },
            { name: 'Tailwind CSS 4', role: 'Styling', url: 'https://tailwindcss.com' },
            { name: '@react-pdf/renderer', role: 'Client-side PDF generation', url: 'https://react-pdf.org' },
            { name: 'Zod', role: 'API validation', url: 'https://zod.dev' },
            { name: 'Auth.js v5', role: 'User authentication (sign-up, sign-in, password reset)', url: 'https://authjs.dev' },
            { name: '@node-rs/argon2', role: 'Password hashing (argon2id)', url: 'https://github.com/napi-rs/node-rs/tree/main/packages/argon2' },
            { name: 'Resend / Nodemailer', role: 'Transactional email (verify, password reset, lifecycle warnings)', url: 'https://resend.com' },
            { name: 'Anthropic Claude', role: 'Data enrichment (AI)', url: 'https://anthropic.com' },
            { name: 'Google Analytics 4', role: 'Anonymised usage analytics (optional)', url: 'https://marketingplatform.google.com/about/analytics/' },
            { name: 'GitHub Actions', role: 'CI/CD + container registry', url: 'https://github.com/features/actions' },
          ].map((t) => (
            <a
              key={t.name}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-stone-200 bg-white p-3 transition-colors hover:border-amber-300 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-amber-600"
            >
              <p className="font-semibold text-stone-800 dark:text-stone-100">{t.name}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">{t.role}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Links */}
      <section className="mb-10">
        <h2 className="mb-4 font-serif text-2xl font-semibold text-stone-800 dark:text-stone-200">Links</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href="https://github.com/tfindley/oil-blender"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-800 transition-colors hover:border-amber-400 hover:bg-amber-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:border-amber-600 dark:hover:bg-stone-700"
          >
            <span>⭐</span> View Source Code on GitHub
          </a>
          <a
            href="https://github.com/tfindley/oil-blender/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-800 transition-colors hover:border-amber-400 hover:bg-amber-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:border-amber-600 dark:hover:bg-stone-700"
          >
            <span>🐛</span> Report an Issue
          </a>
          <a
            href="https://ko-fi.com/tfindley"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/40"
          >
            <span>☕</span> Support on Ko-fi
          </a>
        </div>
      </section>

      {/* Install as App */}
      <section className="mb-10">
        <h2 className="mb-4 font-serif text-2xl font-semibold text-stone-800 dark:text-stone-200">Add to Your Home Screen</h2>
        <p className="mb-4 text-stone-600 dark:text-stone-400">
          {siteName} works as a home screen app — no App Store required. Once installed it opens full-screen without browser chrome, just like a native app.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
            <h3 className="mb-3 font-semibold text-stone-800 dark:text-stone-200">iPhone &amp; iPad</h3>
            <ol className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
              <li className="flex gap-2"><span className="shrink-0 font-semibold text-amber-700 dark:text-amber-500">1.</span>Open the site in <strong>Safari</strong></li>
              <li className="flex gap-2"><span className="shrink-0 font-semibold text-amber-700 dark:text-amber-500">2.</span>Tap the <strong>Share</strong> button (□↑) in the toolbar</li>
              <li className="flex gap-2"><span className="shrink-0 font-semibold text-amber-700 dark:text-amber-500">3.</span>Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong></li>
              <li className="flex gap-2"><span className="shrink-0 font-semibold text-amber-700 dark:text-amber-500">4.</span>Tap <strong>Add</strong> — done!</li>
            </ol>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
            <h3 className="mb-3 font-semibold text-stone-800 dark:text-stone-200">Android</h3>
            <ol className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
              <li className="flex gap-2"><span className="shrink-0 font-semibold text-amber-700 dark:text-amber-500">1.</span>Open the site in <strong>Chrome</strong></li>
              <li className="flex gap-2"><span className="shrink-0 font-semibold text-amber-700 dark:text-amber-500">2.</span>Tap the menu <strong>⋮</strong> in the top right</li>
              <li className="flex gap-2"><span className="shrink-0 font-semibold text-amber-700 dark:text-amber-500">3.</span>Tap <strong>&ldquo;Install app&rdquo;</strong> or <strong>&ldquo;Add to Home Screen&rdquo;</strong></li>
              <li className="flex gap-2"><span className="shrink-0 font-semibold text-amber-700 dark:text-amber-500">4.</span>Tap <strong>Install</strong> to confirm</li>
            </ol>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
            <h3 className="mb-3 font-semibold text-stone-800 dark:text-stone-200">Desktop</h3>
            <ol className="space-y-2 text-sm text-stone-600 dark:text-stone-400">
              <li className="flex gap-2"><span className="shrink-0 font-semibold text-amber-700 dark:text-amber-500">1.</span>Open in <strong>Chrome</strong> or <strong>Edge</strong></li>
              <li className="flex gap-2"><span className="shrink-0 font-semibold text-amber-700 dark:text-amber-500">2.</span>Click the <strong>install icon ⊕</strong> in the address bar</li>
              <li className="flex gap-2"><span className="shrink-0 font-semibold text-amber-700 dark:text-amber-500">3.</span>Click <strong>Install</strong></li>
            </ol>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
        <h3 className="mb-2 font-semibold text-stone-800 dark:text-stone-200">Disclaimer</h3>
        <p>
          The information provided on this site is for educational and general wellness purposes only. It is not
          intended as medical advice and should not replace professional healthcare consultation. Essential oils
          are potent substances — always conduct a patch test before applying to skin, and keep out of reach of
          children. If you are pregnant, nursing, or have a medical condition, consult a qualified professional
          before using any essential oil blend.
        </p>
        <p className="mt-2">
          Oil compatibility data is generated with AI assistance and curated by the developer. While care is
          taken to ensure accuracy, we make no guarantees. <strong>Use at your own risk.</strong>
        </p>
      </div>
    </div>
  )
}
