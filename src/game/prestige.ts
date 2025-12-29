import {
  createEmptyOwnership,
  createEmptyUpgradeOwnership,
  type AssetConfig,
  type PlayerState,
} from "./state";

export interface PrestigeParams {
  prestigeMinNetWorth: number;
  prestigeDivisor: number;
  prestigeExponent: number;
  prestigeMultiplierPerPoint: number;
}

export interface PrestigeResult {
  state: PlayerState;
  pointsEarned: number;
  netWorth: number;
  prestigeUnlocked: boolean;
}

export function calculateNetWorth(
  cash: number,
  assetsOwned: Record<string, number>,
  assets: AssetConfig[],
): number {
  const assetValue = assets.reduce((sum, asset) => {
    const owned = assetsOwned[asset.id] ?? 0;
    return sum + owned * asset.baseCost;
  }, 0);

  return cash + assetValue;
}

export function calculatePrestigePoints(
  netWorth: number,
  divisor: number,
  exponent: number,
): number {
  if (divisor <= 0 || exponent <= 0 || netWorth <= 0) {
    return 0;
  }
  return Math.floor(Math.pow(netWorth / divisor, exponent));
}

export function calculatePrestigeMultiplier(
  totalPoints: number,
  perPoint: number,
): number {
  if (perPoint <= 0 || totalPoints <= 0) {
    return 1;
  }
  return 1 + totalPoints * perPoint;
}

export function performPrestigeReset(
  state: PlayerState,
  assets: AssetConfig[],
  upgradeIds: string[],
  params: PrestigeParams,
  now = Date.now(),
): PrestigeResult {
  const netWorth = calculateNetWorth(state.cash, state.assetsOwned, assets);
  const prestigeUnlocked = netWorth >= params.prestigeMinNetWorth;

  if (!prestigeUnlocked) {
    return {
      state,
      netWorth,
      pointsEarned: 0,
      prestigeUnlocked: false,
    };
  }

  const pointsEarned = calculatePrestigePoints(
    netWorth,
    params.prestigeDivisor,
    params.prestigeExponent,
  );

  const nextPointsTotal = state.prestige.pointsTotal + pointsEarned;

  const resetState: PlayerState = {
    ...state,
    cash: 0,
    assetsOwned: createEmptyOwnership(
      assets.map((asset) => asset.id),
      0,
    ),
    upgradesOwned: createEmptyUpgradeOwnership(upgradeIds),
    prestige: {
      pointsTotal: nextPointsTotal,
      lastResetAt: now,
    },
    lastSeenAt: now,
  };

  return {
    state: resetState,
    netWorth,
    prestigeUnlocked: true,
    pointsEarned,
  };
}
