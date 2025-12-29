import type { AssetConfig, AssetOwnedMap, UpgradeConfig } from "./state";

export interface IncomeContext {
  assets: AssetConfig[];
  upgrades?: UpgradeConfig[];
  assetsOwned: AssetOwnedMap;
  assetMultipliers?: Record<string, number>;
  globalMultipliers?: number[];
  eventMultiplier?: number;
  prestigeMultiplier?: number;
}

const EPSILON = 1e-9;

export function calculateAssetCost(
  baseCost: number,
  costGrowth: number,
  owned: number,
): number {
  if (owned < 0) return baseCost;
  if (costGrowth <= 0) return baseCost;
  return baseCost * Math.pow(costGrowth, owned);
}

export function calculateBulkCost(
  baseCost: number,
  costGrowth: number,
  owned: number,
  quantity: number,
): number {
  if (quantity <= 0) {
    return 0;
  }

  if (costGrowth === 1) {
    return baseCost * quantity;
  }

  const startCost = Math.pow(costGrowth, owned);
  const numerator = Math.pow(costGrowth, quantity) - 1;
  const denominator = costGrowth - 1;

  if (Math.abs(denominator) < EPSILON) {
    return baseCost * quantity;
  }

  return baseCost * startCost * (numerator / denominator);
}

export function calculateAssetIncomePerSec(
  baseIncomePerSec: number,
  owned: number,
  multiplier = 1,
): number {
  return owned * baseIncomePerSec * multiplier;
}

export function calculateTotalIncomePerSec(context: IncomeContext): number {
  const {
    assets,
    assetsOwned,
    assetMultipliers = {},
    globalMultipliers = [],
    eventMultiplier = 1,
    prestigeMultiplier = 1,
  } = context;

  const baseSum = assets.reduce((total, asset) => {
    const owned = assetsOwned[asset.id] ?? 0;
    if (owned <= 0) return total;

    const perAssetMultiplier = assetMultipliers[asset.id] ?? 1;
    return total + calculateAssetIncomePerSec(asset.baseIncomePerSec, owned, perAssetMultiplier);
  }, 0);

  const globalProduct = globalMultipliers.reduce((product, value) => product * value, 1);

  return baseSum * globalProduct * eventMultiplier * prestigeMultiplier;
}
