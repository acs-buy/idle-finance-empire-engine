"use client";

import { useEffect } from "react";
import { ANALYTICS_EVENTS, ensureUtmCaptured, track } from "@/analytics/tracker";

export function LandingTracker() {
  useEffect(() => {
    ensureUtmCaptured();
    track(ANALYTICS_EVENTS.LANDING_VIEW);
  }, []);

  return null;
}
