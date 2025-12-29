import { loadServerConfig } from "@/engine/config/server";

export default function DocsPage() {
  const config = loadServerConfig();
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              {config.game.name}
            </p>
            <a
              href="/play"
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-emerald-300"
            >
              Play now
            </a>
          </div>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Player Guide
          </h1>
          <p className="text-lg text-slate-300">
            Welcome to the compounding grind. This guide breaks down the loop,
            categories, upgrades, offline gains, and prestige so you can scale
            faster and climb the leaderboard.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-slate-100">Core Loop</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li>Earn cash every second from the assets you own.</li>
            <li>Reinvest into higher tier assets to scale income faster.</li>
            <li>Unlock upgrades that multiply production and efficiency.</li>
            <li>Grow net worth to unlock prestige and permanent power.</li>
          </ul>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-slate-100">Investing</h2>
            <p className="mt-3 text-sm text-slate-300">
              Every asset has a base cost and a growth curve. Buying more raises
              the price, but also scales income per second. Always check the best
              income per cost ratio for your next buy.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-slate-100">Upgrades</h2>
            <p className="mt-3 text-sm text-slate-300">
              Upgrades unlock at cash milestones. They multiply income, unlock
              efficiencies, or amplify progression. Early upgrades snowball hard,
              so grab them as soon as they are affordable.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-slate-100">
            Offline Earnings
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            When you return, you collect earnings based on your last income per
            second, capped by your offline limit. Boosts increase the multiplier
            and let you stack bigger returns between sessions.
          </p>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-slate-100">Categories</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>Real Estate: steady cash flow and long-term stability.</li>
              <li>Financial Markets: diversified returns and compounding.</li>
              <li>Businesses: scalable income with higher upside.</li>
              <li>Automation & Leverage: systems that accelerate growth.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-slate-100">Prestige</h2>
            <p className="mt-3 text-sm text-slate-300">
              Prestige resets cash and assets, but grants permanent bonuses. Push
              for bigger net worth before resetting to maximize long-term growth.
            </p>
            <p className="mt-3 text-sm text-slate-300">
              A good rule: prestige when progress slows and your next tier feels
              out of reach.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-slate-100">VIP</h2>
          <p className="mt-3 text-sm text-slate-300">
            VIP accelerates your progression with stronger offline bonuses and
            faster prestige scaling. If you are chasing leaderboard speed, VIP
            compresses the grind.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-slate-100">
            Pro Tips
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li>Buy in bursts: save, then reinvest into the best ROI asset.</li>
            <li>Keep your offline cap high to profit while away.</li>
            <li>Track net worth, not just cash, to time prestige well.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
