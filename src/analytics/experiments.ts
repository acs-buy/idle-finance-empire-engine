import { getOrCreateAnonymousId } from "./tracker";

const STORAGE_KEY = "idle_finance_exp";

type AssignmentMap = Record<string, Record<string, string>>;

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

function readAssignments(): AssignmentMap {
  const raw = safeStorageGet(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AssignmentMap;
  } catch {
    return {};
  }
}

function writeAssignments(value: AssignmentMap): void {
  safeStorageSet(STORAGE_KEY, JSON.stringify(value));
}

function pickVariant(seed: string, variants: string[]): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % variants.length;
  return variants[index] ?? variants[0];
}

export function getOrAssignVariant(
  experimentKey: string,
  variants: string[],
): string {
  if (typeof window === "undefined") return variants[0];

  const anonymousId = getOrCreateAnonymousId();
  const assignments = readAssignments();
  const userAssignments = assignments[anonymousId] ?? {};
  const existing = userAssignments[experimentKey];
  if (existing && variants.includes(existing)) {
    return existing;
  }

  const assigned = pickVariant(`${anonymousId}:${experimentKey}`, variants);
  userAssignments[experimentKey] = assigned;
  assignments[anonymousId] = userAssignments;
  writeAssignments(assignments);
  return assigned;
}
