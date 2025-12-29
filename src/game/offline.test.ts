import { describe, expect, it } from "vitest";
import { calculateOfflineEarnings } from "./offline";
import { createInitialPlayerState } from "./state";

describe("offline earnings", () => {
  it("clamps delta seconds to offline cap and applies multiplier", () => {
    const now = Date.now();
    const state = createInitialPlayerState({
      schemaVersion: 1,
      now: now - 10 * 60 * 60 * 1000, // last seen 10h ago
      offlineCapSec: 2 * 60 * 60, // 2h cap
      offlineMultiplier: 1.5,
    });

    const result = calculateOfflineEarnings(state, {
      now,
      incomePerSecAtSave: 100,
    });

    // Should clamp to 2h = 7200s
    expect(result.offlineSeconds).toBe(7200);
    expect(result.offlineEarnings).toBeCloseTo(100 * 7200 * 1.5, 5);
  });

  it("returns zero when incomePerSec is zero", () => {
    const now = Date.now();
    const state = createInitialPlayerState({
      schemaVersion: 1,
      now: now - 5_000,
    });

    const result = calculateOfflineEarnings(state, {
      now,
      incomePerSecAtSave: 0,
    });

    expect(result.offlineSeconds).toBe(0);
    expect(result.offlineEarnings).toBe(0);
  });
});
