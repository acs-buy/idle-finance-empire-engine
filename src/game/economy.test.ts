import { describe, expect, it } from "vitest";
import {
  calculateAssetCost,
  calculateBulkCost,
  calculateTotalIncomePerSec,
} from "./economy";
import type { AssetConfig } from "./state";

const sampleAssets: AssetConfig[] = [
  {
    id: "cash_gen",
    name: "Cash Generator",
    category: "cash",
    baseCost: 10,
    costGrowth: 1.15,
    baseIncomePerSec: 1,
    unlockAtCash: 0,
    description: "Basic generator",
  },
  {
    id: "bond",
    name: "Bonds",
    category: "fixed_income",
    baseCost: 100,
    costGrowth: 1.1,
    baseIncomePerSec: 5,
    unlockAtCash: 50,
    description: "Steady fixed income",
  },
];

describe("economy cost formulas", () => {
  it("calculates single purchase cost with exponential growth", () => {
    expect(calculateAssetCost(10, 1.15, 0)).toBeCloseTo(10);
    expect(calculateAssetCost(10, 1.15, 1)).toBeCloseTo(11.5);
    expect(calculateAssetCost(10, 1.15, 2)).toBeCloseTo(13.225);
  });

  it("calculates bulk purchase cost", () => {
    const bulk3 = calculateBulkCost(10, 1.1, 0, 3);
    // Manual: 10 * (1 + 1.1 + 1.21) = 33.1
    expect(bulk3).toBeCloseTo(33.1, 3);

    const bulkFromOwned = calculateBulkCost(10, 1.1, 5, 2);
    const manual = 10 * Math.pow(1.1, 5) * ((Math.pow(1.1, 2) - 1) / 0.1);
    expect(bulkFromOwned).toBeCloseTo(manual, 5);
  });

  it("bulk cost for k units matches sum of individual costs", () => {
    const baseCost = 25;
    const growth = 1.07;
    const k = 10;

    const bulk = calculateBulkCost(baseCost, growth, 0, k);
    let sum = 0;
    for (let i = 0; i < k; i += 1) {
      sum += calculateAssetCost(baseCost, growth, i);
    }

    expect(bulk).toBeCloseTo(sum, 6);
  });
});

describe("economy income formulas", () => {
  it("returns zero contribution when owned is zero", () => {
    const income = calculateTotalIncomePerSec({
      assets: sampleAssets,
      assetsOwned: { cash_gen: 0, bond: 0 },
    });
    expect(income).toBe(0);
  });

  it("sums base income without modifiers when owned > 0", () => {
    const income = calculateTotalIncomePerSec({
      assets: sampleAssets,
      assetsOwned: { cash_gen: 10, bond: 0 },
    });
    expect(income).toBeCloseTo(10 * sampleAssets[0].baseIncomePerSec, 6);
  });

  it("sums income with asset and global multipliers", () => {
    const income = calculateTotalIncomePerSec({
      assets: sampleAssets,
      assetsOwned: {
        cash_gen: 5, // 5 * 1 = 5
        bond: 2, // 2 * 5 = 10
      },
      assetMultipliers: {
        bond: 1.2, // bonds boosted to 12
      },
      globalMultipliers: [1.1],
      eventMultiplier: 1.05,
      prestigeMultiplier: 1.02,
    });

    // base sum: cash_gen 5 + bonds (10 * 1.2) = 17
    const expected = 17 * 1.1 * 1.05 * 1.02;
    expect(income).toBeCloseTo(expected, 6);
  });
});
