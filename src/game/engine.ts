import type { AssetConfig, PlayerState, UpgradeConfig } from "./state";
import { calculateAssetCost, calculateBulkCost } from "./economy";

export interface PurchaseResult {
  state: PlayerState;
  success: boolean;
  totalCost: number;
}

export interface UpgradePurchaseResult extends PurchaseResult {
  appliedModifier?: "offlineCapSec" | "offlineMultiplier";
}

export function tick(
  state: PlayerState,
  incomePerSec: number,
  deltaSeconds: number,
): PlayerState {
  if (deltaSeconds <= 0 || incomePerSec <= 0) {
    return state;
  }

  const earnings = incomePerSec * deltaSeconds;
  const nextLastSeen = state.lastSeenAt + deltaSeconds * 1000;

  return {
    ...state,
    cash: state.cash + earnings,
    lastSeenAt: nextLastSeen,
  };
}

export function purchaseAsset(
  state: PlayerState,
  asset: AssetConfig,
  quantity = 1,
): PurchaseResult {
  if (quantity <= 0) {
    return { state, success: false, totalCost: 0 };
  }

  const owned = state.assetsOwned[asset.id] ?? 0;
  const totalCost =
    quantity === 1
      ? calculateAssetCost(asset.baseCost, asset.costGrowth, owned)
      : calculateBulkCost(asset.baseCost, asset.costGrowth, owned, quantity);

  if (state.cash < totalCost) {
    return { state, success: false, totalCost };
  }

  return {
    success: true,
    totalCost,
    state: {
      ...state,
      cash: state.cash - totalCost,
      assetsOwned: {
        ...state.assetsOwned,
        [asset.id]: owned + quantity,
      },
    },
  };
}

export function buyUpgrade(
  state: PlayerState,
  upgrade: UpgradeConfig,
): UpgradePurchaseResult {
  const alreadyOwned = state.upgradesOwned[upgrade.id];
  if (alreadyOwned && !upgrade.stackable) {
    return { state, success: false, totalCost: 0 };
  }

  const price = upgrade.price;
  if (state.cash < price) {
    return { state, success: false, totalCost: price };
  }

  const updatedState: PlayerState = {
    ...state,
    cash: state.cash - price,
    upgradesOwned: {
      ...state.upgradesOwned,
      [upgrade.id]: true,
    },
  };

  let appliedModifier: UpgradePurchaseResult["appliedModifier"];

  if (upgrade.type === "offline_cap") {
    appliedModifier = "offlineCapSec";
    updatedState.modifiers = {
      ...state.modifiers,
      offlineCapSec: Math.max(
        state.modifiers.offlineCapSec,
        upgrade.value * 60 * 60,
      ),
      offlineMultiplier: state.modifiers.offlineMultiplier,
    };
  } else if (upgrade.type === "offline_multiplier") {
    appliedModifier = "offlineMultiplier";
    updatedState.modifiers = {
      ...state.modifiers,
      offlineCapSec: state.modifiers.offlineCapSec,
      offlineMultiplier: Math.max(state.modifiers.offlineMultiplier, upgrade.value),
    };
  }

  return {
    state: updatedState,
    success: true,
    totalCost: price,
    appliedModifier,
  };
}
