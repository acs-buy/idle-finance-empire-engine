import { describe, expect, it } from "vitest";
import assetsData from "../../data/assets.json";
import { calculateAssetCost, calculateTotalIncomePerSec } from "./economy";
import { purchaseAsset, tick } from "./engine";
import { createInitialPlayerState, type AssetConfig } from "./state";

const assets = assetsData.assets as AssetConfig[];
const savings = assets.find((a) => a.id === "savings_account");

describe("engine smoke test", () => {
  it("runs a minimal loop: buy, tick 60s, income increases cash, rebuy if possible", () => {
    expect(savings).toBeDefined();
    if (!savings) return;

    // Initialize default state and seed some starter cash for the smoke test.
    let state = createInitialPlayerState({
      schemaVersion: 1,
      assetIds: assets.map((a) => a.id),
    });
    state = { ...state, cash: 100 };

    // Buy one savings account.
    const firstBuy = purchaseAsset(state, savings, 1);
    expect(firstBuy.success).toBe(true);
    state = firstBuy.state;

    // Compute income and tick 60 seconds.
    const incomePerSec = calculateTotalIncomePerSec({
      assets,
      assetsOwned: state.assetsOwned,
    });
    expect(incomePerSec).toBeGreaterThan(0);

    const afterTick = tick(state, incomePerSec, 60);
    expect(afterTick.cash).toBeGreaterThan(state.cash);
    state = afterTick;

    // Attempt to buy another asset if affordable.
    const nextCost = calculateAssetCost(
      savings.baseCost,
      savings.costGrowth,
      state.assetsOwned[savings.id],
    );
    const secondBuy = purchaseAsset(state, savings, 1);

    if (state.cash >= nextCost) {
      expect(secondBuy.success).toBe(true);
      expect(secondBuy.state.assetsOwned[savings.id]).toBe(
        state.assetsOwned[savings.id] + 1,
      );
    } else {
      expect(secondBuy.success).toBe(false);
    }
  });
});
