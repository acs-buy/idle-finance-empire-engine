export type UTMData = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  firstLandingAt?: number;
  referrer?: string;
};

const STORAGE_KEY = "idle-finance-utm";

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

export function getPersistedUtm(): UTMData | null {
  const raw = safeStorageGet(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UTMData;
  } catch {
    return null;
  }
}

export function persistUtm(data: UTMData): void {
  safeStorageSet(STORAGE_KEY, JSON.stringify(data));
}

export function parseUtmFromUrl(search: string): UTMData {
  const params = new URLSearchParams(search);
  return {
    source: params.get("utm_source") || undefined,
    medium: params.get("utm_medium") || undefined,
    campaign: params.get("utm_campaign") || undefined,
    term: params.get("utm_term") || undefined,
    content: params.get("utm_content") || undefined,
  };
}

export function captureUtmOnFirstVisit(): UTMData | null {
  if (typeof window === "undefined") return null;
  const existing = getPersistedUtm();
  if (existing) return existing;

  const parsed = parseUtmFromUrl(window.location.search);
  const hasAny = Object.values(parsed).some((value) => value);
  const referrer = document.referrer || undefined;
  const payload: UTMData = {
    ...parsed,
    referrer,
    firstLandingAt: Date.now(),
  };

  if (!hasAny && !referrer) {
    return null;
  }

  persistUtm(payload);
  return payload;
}
