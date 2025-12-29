import { ANALYTICS_EVENTS, type AnalyticsEventName } from "./events";
import { captureUtmOnFirstVisit, getPersistedUtm, type UTMData } from "./utm";

type TrackPayload = Record<string, unknown>;

const ANON_KEY = "idle-finance-anonymous-id";
const LEGACY_ANON_KEY = "anonymousId";

function safeStorageGet(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function generateAnonymousId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `anon_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function getAnonymousId(): string {
  const existing = safeStorageGet(ANON_KEY);
  if (existing) return existing;
  const id = generateAnonymousId();
  safeStorageSet(ANON_KEY, id);
  return id;
}

export function getOrCreateAnonymousId(): string {
  const existing = safeStorageGet(ANON_KEY);
  if (existing) return existing;

  const legacy = safeStorageGet(LEGACY_ANON_KEY);
  if (legacy) {
    safeStorageSet(ANON_KEY, legacy);
    return legacy;
  }

  const id = generateAnonymousId();
  safeStorageSet(ANON_KEY, id);
  return id;
}

export function getUtmData(): UTMData | null {
  return getPersistedUtm();
}

export function ensureUtmCaptured(): void {
  captureUtmOnFirstVisit();
}

export function track(eventName: AnalyticsEventName, payload: TrackPayload = {}): void {
  if (typeof window === "undefined") return;

  const utm = getUtmData();
  const base = {
    event: eventName,
    anonymousId: getOrCreateAnonymousId(),
    utm,
    referrer: document.referrer || undefined,
    path: window.location.pathname,
    timestamp: Date.now(),
    ...payload,
  };

  // Non-blocking, fail silently.
  setTimeout(() => {
    try {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.debug("[analytics]", base);
      }
      const body = JSON.stringify({
        event: base.event,
        anonymousId: base.anonymousId,
        payload,
        path: base.path,
        referrer: base.referrer,
        utm_source: utm?.source,
        utm_medium: utm?.medium,
        utm_campaign: utm?.campaign,
        utm_term: utm?.term,
        utm_content: utm?.content,
        ts: base.timestamp,
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          "/api/analytics",
          new Blob([body], { type: "application/json" }),
        );
      } else {
        fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => undefined);
      }
    } catch {
      // ignore
    }
  }, 0);
}

export { ANALYTICS_EVENTS };
