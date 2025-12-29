export type AssetCategory =
  | "cash"
  | "equity"
  | "real_estate"
  | "fixed_income"
  | "crypto"
  | "hedge";

export type AssetOwnedMap = Record<string, number>;
export type UpgradeOwnedMap = Record<string, boolean>;

export interface AssetConfig {
  id: string;
  name: string;
  category: AssetCategory;
  baseCost: number;
  costGrowth: number;
  baseIncomePerSec: number;
  unlockAtCash: number;
  description: string;
  icon?: string;
}

export type UpgradeType =
  | "global_multiplier"
  | "asset_multiplier"
  | "offline_cap"
  | "offline_multiplier"
  | "qol";

export interface UpgradeConfig {
  id: string;
  name: string;
  description: string;
  price: number;
  unlockAtCash: number;
  type: UpgradeType;
  targetAssetId?: string;
  value: number;
  stackable: boolean;
}

export interface EventConfig {
  id: string;
  name: string;
  description: string;
  durationSec: number;
  multiplier: number;
  weight: number;
}

export interface PrestigeState {
  pointsTotal: number;
  lastResetAt: number | null;
}

export interface ModifiersState {
  offlineCapSec: number;
  offlineMultiplier: number;
}

export interface MarketingAttribution {
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  referrer?: string;
  firstLandingAt?: number;
}

export interface EntitlementsState {
  vipUntil?: number;
  offlineBoostUntil?: number;
}

export interface PlayerState {
  schemaVersion: number;
  createdAt: number;
  lastSeenAt: number;
  cash: number;
  assetsOwned: AssetOwnedMap;
  upgradesOwned: UpgradeOwnedMap;
  prestige: PrestigeState;
  modifiers: ModifiersState;
  marketing: MarketingAttribution;
  entitlements: EntitlementsState;
}

export interface CreateStateOptions {
  schemaVersion: number;
  now?: number;
  assetIds?: string[];
  upgradeIds?: string[];
  offlineCapSec?: number;
  offlineMultiplier?: number;
}

export const DEFAULT_OFFLINE_CAP_SEC = 8 * 60 * 60; // 8h free cap by default
export const DEFAULT_OFFLINE_MULTIPLIER = 1;

export const createEmptyOwnership = (
  ids: string[],
  initialValue = 0,
): Record<string, number> =>
  ids.reduce<Record<string, number>>((acc, id) => {
    acc[id] = initialValue;
    return acc;
  }, {});

export const createEmptyUpgradeOwnership = (ids: string[]): UpgradeOwnedMap =>
  ids.reduce<UpgradeOwnedMap>((acc, id) => {
    acc[id] = false;
    return acc;
  }, {});

export function createInitialPlayerState(options: CreateStateOptions): PlayerState {
  const {
    schemaVersion,
    now = Date.now(),
    assetIds = [],
    upgradeIds = [],
    offlineCapSec = DEFAULT_OFFLINE_CAP_SEC,
    offlineMultiplier = DEFAULT_OFFLINE_MULTIPLIER,
  } = options;

  return {
    schemaVersion,
    createdAt: now,
    lastSeenAt: now,
    cash: 0,
    assetsOwned: createEmptyOwnership(assetIds, 0),
    upgradesOwned: createEmptyUpgradeOwnership(upgradeIds),
    prestige: {
      pointsTotal: 0,
      lastResetAt: null,
    },
    modifiers: {
      offlineCapSec,
      offlineMultiplier,
    },
    marketing: {
      utm: {},
    },
    entitlements: {},
  };
}
