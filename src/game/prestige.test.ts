import { describe, expect, it } from "vitest";
import {
  calculatePrestigePoints,
  calculatePrestigeMultiplier,
  performPrestigeReset,
} from "./prestige";
import { createInitialPlayerState, type AssetConfig } from "./state";

const assets: AssetConfig[] = [
  {
    id: "cash_gen",
    name: "Cash Generator",
    category: "cash",
    baseCost: 10,
    costGrowth: 1.15,
    baseIncomePerSec: 1,
    unlockAtCash: 0,
    description: "Basic",
  },
  {
    id: "bond",
    name: "Bonds",
    category: "fixed_income",
    baseCost: 100,
    costGrowth: 1.1,
    baseIncomePerSec: 5,
    unlockAtCash: 50,
    description: "Steady",
  },
];

const params = {
  prestigeMinNetWorth: 1_000,
  prestigeDivisor: 1_000,
  prestigeExponent: 0.5,
  prestigeMultiplierPerPoint: 0.01,
};

describe("prestige thresholds and points", () => {
  it("does not unlock prestige below threshold", () => {
    const state = createInitialPlayerState({
      schemaVersion: 1,
    });

    const result = performPrestigeReset(state, assets, [], params, Date.now());
    expect(result.prestigeUnlocked).toBe(false);
    expect(result.pointsEarned).toBe(0);
  });

  it("prestige points grow with higher net worth", () => {
    const low = calculatePrestigePoints(10_000, params.prestigeDivisor, params.prestigeExponent);
    const high = calculatePrestigePoints(100_000, params.prestigeDivisor, params.prestigeExponent);
    expect(high).toBeGreaterThan(low);
  });

  it("reset zeroes cash/assets and adds prestige points", () => {
    const now = Date.now();
    const state = createInitialPlayerState({
      schemaVersion: 1,
      now,
      assetIds: assets.map((a) => a.id),
      upgradeIds: ["u1"],
    });

    // Give the player some wealth
    const wealthy: typeof state = {
      ...state,
      cash: 5_000,
      assetsOwned: {
        ...state.assetsOwned,
        cash_gen: 10,
        bond: 5,
      },
      prestige: {
        ...state.prestige,
        pointsTotal: 2,
      },
      upgradesOwned: { u1: true },
    };

    const result = performPrestigeReset(wealthy, assets, ["u1"], params, now + 1_000);

    expect(result.prestigeUnlocked).toBe(true);
    expect(result.pointsEarned).toBeGreaterThan(0);
    expect(result.state.cash).toBe(0);
    expect(result.state.assetsOwned.cash_gen).toBe(0);
    expect(result.state.assetsOwned.bond).toBe(0);
    expect(result.state.upgradesOwned.u1).toBe(false);
    expect(result.state.prestige.pointsTotal).toBe(
      wealthy.prestige.pointsTotal + result.pointsEarned,
    );
    expect(calculatePrestigeMultiplier(result.state.prestige.pointsTotal, params.prestigeMultiplierPerPoint)).toBeGreaterThan(
      1,
    );
  });
});
