import Link from "next/link";

export default function ForCreatorsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            For Creators
          </p>
          <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
            Launch your own idle game in days — not months.
          </h1>
          <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
            Idle Finance Empire is now a modular engine. Customize content, pacing,
            and monetization without rebuilding the core loop.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/?demo=true"
              className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm"
            >
              Try the 5-minute demo
            </Link>
            <a
              href="mailto:hello@idlefinanceempire.com?subject=Idle%20Engine%20Early%20Access"
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-100 hover:border-white/40"
            >
              Get early access
            </a>
            <Link
              href="/play"
              className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-slate-100 hover:bg-white/15"
            >
              Back to /play
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Demo mode built in",
              body: "Showcase fast progression with a single flag.",
            },
            {
              title: "Portfolio allocation visuals",
              body: "Explain growth at a glance with stacked allocations.",
            },
            {
              title: "Share cards",
              body: "Let players export their progress with branded images.",
            },
            {
              title: "Analytics-ready",
              body: "Track funnels, VIP conversion, and key events.",
            },
            {
              title: "Monetization hooks",
              body: "Stripe checkout and entitlements are already wired.",
            },
            {
              title: "Configurable content",
              body: "Swap assets, upgrades, and copy without touching the engine.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-slate-100">{item.title}</p>
              <p className="mt-2 text-sm text-slate-400">{item.body}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
          <p className="text-slate-100">
            Want the engine customized for your audience?
          </p>
          <p className="mt-2">
            Send your studio name and target theme. We will reply with a tailored
            roadmap and build estimate.
          </p>
        </section>
      </div>
    </div>
  );
}
