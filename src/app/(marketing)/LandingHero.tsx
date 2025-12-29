"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_EVENTS, ensureUtmCaptured, track } from "@/analytics/tracker";
import { getOrAssignVariant } from "@/analytics/experiments";
import Link from "next/link";
import { PlayButton } from "./PlayButton";
import type { GameConfig } from "@/engine/config/types";

const EXPERIMENT_KEY = "landing_v2";
const VARIANTS = ["B", "C"] as const;

type Variant = (typeof VARIANTS)[number];

export function LandingHero({ config }: { config: GameConfig }) {
  const [variant, setVariant] = useState<Variant>("B");

  useEffect(() => {
    ensureUtmCaptured();
    const assigned = getOrAssignVariant(EXPERIMENT_KEY, [...VARIANTS]);
    const resolved = assigned === "C" ? "C" : "B";
    setVariant(resolved);
    track(ANALYTICS_EVENTS.LANDING_VIEW, {
      experimentKey: EXPERIMENT_KEY,
      variant: resolved,
    });
  }, []);

  const heroCopy =
    variant === "C" ? config.landing.variantC : config.landing.baseline;
  const heroTitle = heroCopy.heroTitle;
  const heroBody = heroCopy.heroSubtitle;
  const ctaLabel = heroCopy.ctaLabel;

  return (
    <header className="flex flex-col gap-6">
      <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
        {config.game.name}
      </p>
      <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
        {heroTitle}
      </h1>
      <p className="max-w-2xl text-lg text-slate-300">{heroBody}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <PlayButton
          label={ctaLabel}
          experimentKey={EXPERIMENT_KEY}
          variant={variant}
          color={config.branding.primaryColor}
        />
        <Link
          href="/docs"
          className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-slate-100 transition hover:border-slate-500"
        >
          Player Guide
        </Link>
      </div>
    </header>
  );
}
