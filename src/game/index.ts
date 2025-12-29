import { calculateTotalIncomePerSec } from "./economy";
import {
  buyUpgrade as buyUpgradeInternal,
  purchaseAsset as purchaseAssetInternal,
  tick as tickInternal,
} from "./engine";
import { calculateOfflineEarnings } from "./offline";
import {
  calculateNetWorth,
  calculatePrestigeMultiplier,
  performPrestigeReset,
  type PrestigeParams,
} from "./prestige";
import {
  createInitialPlayerState,
  type AssetConfig,
  type PlayerState,
  type UpgradeConfig,
} from "./state";

export interface EngineConfig {
  assets: AssetConfig[];
  upgrades: UpgradeConfig[];
  prestige: PrestigeParams;
  eventMultiplier?: number;
}

export interface DerivedState {
  incomePerSec: number;
  netWorth: number;
  assetMultipliers: Record<string, number>;
  globalMultipliers: number[];
  eventMultiplier: number;
  prestigeMultiplier: number;
}

export function createDefaultState(config: EngineConfig): PlayerState {
  return createInitialPlayerState({
    schemaVersion: 1,
    assetIds: config.assets.map((a) => a.id),
    upgradeIds: config.upgrades.map((u) => u.id),
  });
}

function deriveMultipliers(
  state: PlayerState,
  upgrades: UpgradeConfig[],
): Pick<DerivedState, "assetMultipliers" | "globalMultipliers"> {
  const assetMultipliers: Record<string, number> = {};
  const globalMultipliers: number[] = [];

  upgrades.forEach((u) => {
    if (!state.upgradesOwned[u.id]) return;
    if (u.type === "global_multiplier") {
      globalMultipliers.push(u.value);
    } else if (u.type === "asset_multiplier" && u.targetAssetId) {
      const prev = assetMultipliers[u.targetAssetId] ?? 1;
      assetMultipliers[u.targetAssetId] = prev * u.value;
    }
  });

  return { assetMultipliers, globalMultipliers };
}

export function computeDerived(state: PlayerState, config: EngineConfig): DerivedState {
  const { assetMultipliers, globalMultipliers } = deriveMultipliers(
    state,
    config.upgrades,
  );

  const prestigeMultiplier = calculatePrestigeMultiplier(
    state.prestige.pointsTotal,
    config.prestige.prestigeMultiplierPerPoint,
  );

  const eventMultiplier = config.eventMultiplier ?? 1;
  const incomePerSec = calculateTotalIncomePerSec({
    assets: config.assets,
    assetsOwned: state.assetsOwned,
    assetMultipliers,
    globalMultipliers,
    eventMultiplier,
    prestigeMultiplier,
  });

  const netWorth = calculateNetWorth(state.cash, state.assetsOwned, config.assets);

  return {
    incomePerSec,
    netWorth,
    assetMultipliers,
    globalMultipliers,
    eventMultiplier,
    prestigeMultiplier,
  };
}

export function tick(
  state: PlayerState,
  dtSec: number,
  config: EngineConfig,
): PlayerState {
  const derived = computeDerived(state, config);
  return tickInternal(state, derived.incomePerSec, dtSec);
}

export function purchaseAsset(
  state: PlayerState,
  assetId: string,
  quantity: number,
  config: EngineConfig,
): PlayerState {
  const asset = config.assets.find((a) => a.id === assetId);
  if (!asset) return state;
  const result = purchaseAssetInternal(state, asset, quantity);
  return result.state;
}

export function buyUpgrade(
  state: PlayerState,
  upgradeId: string,
  config: EngineConfig,
): PlayerState {
  const upgrade = config.upgrades.find((u) => u.id === upgradeId);
  if (!upgrade) return state;
  const result = buyUpgradeInternal(state, upgrade);
  return result.state;
}

export function applyOfflineEarnings(
  state: PlayerState,
  now: number,
  config: EngineConfig,
): { state: PlayerState; earned: number } {
  const derived = computeDerived(state, config);
  const { offlineEarnings, offlineSeconds } = calculateOfflineEarnings(state, {
    now,
    incomePerSecAtSave: derived.incomePerSec,
  });

  const updated: PlayerState = {
    ...state,
    cash: state.cash + offlineEarnings,
    lastSeenAt: state.lastSeenAt + offlineSeconds * 1000,
  };

  return { state: updated, earned: offlineEarnings };
}

export function canPrestige(state: PlayerState, config: EngineConfig): boolean {
  const netWorth = calculateNetWorth(state.cash, state.assetsOwned, config.assets);
  return netWorth >= config.prestige.prestigeMinNetWorth;
}

export function prestigeReset(
  state: PlayerState,
  config: EngineConfig,
): { state: PlayerState; ppEarned: number } {
  const result = performPrestigeReset(
    state,
    config.assets,
    config.upgrades.map((u) => u.id),
    config.prestige,
  );
  return { state: result.state, ppEarned: result.pointsEarned };
}

// Re-export helpers that may be useful to UI/adapters.
export { calculateAssetCost, calculateBulkCost } from "./economy";
export type { PlayerState, AssetConfig, UpgradeConfig } from "./state";
