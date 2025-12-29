import type { PlayerState } from "./state";

export interface OfflineResult {
  offlineSeconds: number;
  offlineEarnings: number;
}

export interface OfflineContext {
  now: number;
  incomePerSecAtSave: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export function calculateOfflineEarnings(
  state: PlayerState,
  context: OfflineContext,
): OfflineResult {
  const { now, incomePerSecAtSave } = context;
  if (incomePerSecAtSave <= 0) {
    return { offlineSeconds: 0, offlineEarnings: 0 };
  }

  const elapsedSec = clamp(
    (now - state.lastSeenAt) / 1000,
    0,
    state.modifiers.offlineCapSec,
  );

  const earnings = incomePerSecAtSave * elapsedSec * state.modifiers.offlineMultiplier;

  return {
    offlineSeconds: elapsedSec,
    offlineEarnings: earnings,
  };
}
