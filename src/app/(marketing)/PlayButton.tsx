"use client";

import Link from "next/link";
import { ANALYTICS_EVENTS, track } from "@/analytics/tracker";

type PlayButtonProps = {
  label?: string;
  experimentKey?: string;
  variant?: string;
  color?: string;
};

export function PlayButton({
  label = "Play now",
  experimentKey,
  variant,
  color,
}: PlayButtonProps) {
  const payload =
    experimentKey && variant ? { experimentKey, variant } : undefined;
  return (
    <Link
      href="/play"
      className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-slate-900 transition hover:-translate-y-0.5 hover:bg-emerald-300"
      style={color ? { backgroundColor: color } : undefined}
      onClick={() => track(ANALYTICS_EVENTS.CLICK_PLAY, payload ?? {})}
    >
      {label}
    </Link>
  );
}
