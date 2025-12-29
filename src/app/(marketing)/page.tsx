import { LandingHero } from "./LandingHero";
import { loadServerConfig } from "@/engine/config/server";

const features = [
  "Data-driven assets, upgrades, and events loaded from /data JSON",
  "Play instantly without signup; offline earnings and prestige-ready",
  "Lightweight analytics and UTM capture baked into the core loop",
];

export default function MarketingPage() {
  const config = loadServerConfig();
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <LandingHero config={config} />

        <section className="grid gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg"
            >
              <p className="text-sm text-emerald-300">Built-in</p>
              <p className="mt-2 text-base text-slate-200">{feature}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-lg">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Routes
            </p>
            <p className="text-lg text-slate-100">/play</p>
            <p className="text-sm text-slate-400">
              App Router with separate marketing and game groups, ready for
              Supabase, Stripe, and analytics routes.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
