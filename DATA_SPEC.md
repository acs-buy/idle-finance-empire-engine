# DATA_SPEC.md

## Versioning
- Save schema: version integer
- Data configs: versioned via filename or "version" field

## Core Types

### AssetConfig
- id: string (unique)
- name: string
- category: "cash" | "equity" | "real_estate" | "fixed_income" | "crypto" | "hedge"
- baseCost: number
- costGrowth: number
- baseIncomePerSec: number
- unlockAtCash: number (player cash needed to show this asset)
- description: string (short)
- icon?: string (optional)

### UpgradeConfig
- id: string (unique)
- name: string
- description: string
- price: number
- unlockAtCash: number
- type: "global_multiplier" | "asset_multiplier" | "offline_cap" | "offline_multiplier" | "qol"
- targetAssetId?: string (required if type is asset_multiplier)
- value: number (e.g., multiplier 1.2, cap hours 24, etc.)
- stackable: boolean (MVP: false)

### EventConfig
- id: string
- name: string
- description: string
- durationSec: number
- multiplier: number (income multiplier during the event)
- weight: number (relative probability)

## Player State

### PlayerState
- schemaVersion: number
- createdAt: number (epoch ms)
- lastSeenAt: number (epoch ms)
- cash: number
- assetsOwned: Record<assetId, number>
- upgradesOwned: Record<upgradeId, boolean>
- prestige:
  - pointsTotal: number
  - lastResetAt: number | null
- modifiers:
  - offlineCapSec: number (derived; can store or compute)
  - offlineMultiplier: number (derived; can store or compute)
- marketing:
  - utm: { source?: string; medium?: string; campaign?: string; term?: string; content?: string }
  - referrer?: string
  - firstLandingAt?: number
- entitlements:
  - vipUntil?: number (epoch ms)  // MVP can store locally; V1 from server
  - offlineBoostUntil?: number (epoch ms)
