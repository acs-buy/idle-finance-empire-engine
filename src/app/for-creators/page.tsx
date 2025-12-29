// src/app/for-creators/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Idle Engine — For Creators",
  description:
    "Launch your own idle game in days with a proven engine: demo mode, portfolio allocation, share cards, analytics, monetization.",
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ForCreatorsPage() {
  const demoUrl = "/?demo=true";
  const mailtoHref =
    "mailto:contact@idleengine.app?subject=Idle%20Engine%20Early%20Access&body=Hi%2C%0A%0AI%27d%20like%20early%20access%20to%20Idle%20Engine.%0A%0A-%20Name%3A%0A-%20Audience%20size%3A%0A-%20Topic%20%2F%20niche%3A%0A-%20SaaS%20or%20License%20or%20Both%3A%0A%0AThanks!";

  return (
    <main className="min-h-screen bg-[#070A14] text-white">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-sm tracking-[0.24em] text-slate-200/80">
          IDLE ENGINE
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href={demoUrl}
            className={cn(
              "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm",
              "hover:bg-white/10"
            )}
          >
            View Demo
          </Link>
          <a
            href={mailtoHref}
            className={cn(
              "rounded-full bg-[#22c55e] px-4 py-2 text-sm font-semibold text-black",
              "hover:opacity-90"
            )}
          >
            Get Early Access
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-10 pt-10">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-7">
            <p className="mb-4 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200/80">
              Built for creators • SaaS + License
            </p>

            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              Launch your own idle game in days — not months.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200/80 md:text-lg">
              A proven idle engine designed for retention and conversion:
              demo mode, portfolio allocation (Income vs Net Worth), share cards,
              analytics, and monetization — already integrated.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={demoUrl}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium",
                  "hover:bg-white/10"
                )}
              >
                Try the 5-minute demo
              </Link>

              <a
                href={mailtoHref}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl bg-[#22c55e] px-5 py-3 text-sm font-semibold text-black",
                  "hover:opacity-90"
                )}
              >
                Request early access (99€/mo)
              </a>

              <p className="text-xs text-slate-200/60">
                Early access limited to 10 creators.
              </p>
            </div>

            {/* Proof bullets */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <Feature
                title="Retention-first mechanics"
                desc="Progression loops, categories, prestige, and portfolio strategy cues that keep users coming back daily."
              />
              <Feature
                title="Built-in social proof"
                desc="Share cards + portfolio allocation bars to turn player progress into distribution."
              />
              <Feature
                title="Config-driven template"
                desc="Ship a new game by changing config: copy, categories, curves, and pricing (no fork)."
              />
              <Feature
                title="SaaS or License"
                desc="Run it hosted (MRR) or deploy client-side (license + setup). Same engine."
              />
            </div>
          </div>

          {/* Right card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold">What you get</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-200/80">
                <li>• Demo mode (5 minutes to “wow”)</li>
                <li>• Leaderboard with strategy visualization</li>
                <li>• Share cards (X/LinkedIn ready)</li>
                <li>• Analytics events + UTM capture</li>
                <li>• Stripe monetization hooks</li>
                <li>• Cloud save + anonymous sessions</li>
              </ul>

              <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs text-slate-200/60">Pricing</div>
                <div className="mt-2 text-2xl font-semibold">
                  99€ <span className="text-sm text-slate-200/70">/ month</span>
                </div>
                <div className="mt-1 text-xs text-slate-200/60">
                  Early access (10 creators). Upgrade later.
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <Link
                  href={demoUrl}
                  className={cn(
                    "inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium",
                    "hover:bg-white/10"
                  )}
                >
                  Open demo now
                </Link>
                <a
                  href={mailtoHref}
                  className={cn(
                    "inline-flex items-center justify-center rounded-xl bg-[#22c55e] px-5 py-3 text-sm font-semibold text-black",
                    "hover:opacity-90"
                  )}
                >
                  Email me early access
                </a>
                <p className="text-xs text-slate-200/60">
                  Tip: Use the demo link in your outreach.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-sm font-semibold">Recommended outreach line</h3>
              <p className="mt-2 text-sm text-slate-200/80">
                “I built an idle finance game, then turned the engine into a reusable product.
                Here’s a 5-minute demo — want to see what your audience could play daily?”
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 pt-8 text-xs text-slate-200/60">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>© {new Date().getFullYear()} Idle Engine</div>
          <div className="flex gap-4">
            <Link href={demoUrl} className="hover:text-white">
              Demo
            </Link>
            <Link href="/play" className="hover:text-white">
              Play
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-slate-200/70">{desc}</div>
    </div>
  );
}
