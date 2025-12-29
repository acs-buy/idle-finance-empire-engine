# FORMULAS.md

## Numeric Types
- Use number (JS double) but avoid drift by rounding at display boundaries.
- Store cash as a floating number; optionally clamp to 2 decimals for display.
- Use safe guards to prevent NaN/Infinity.

## Definitions
- cash: current currency balance
- incomePerSec: current total income per second
- assets: list of asset types; each asset has owned count
- upgrades: modifiers (global or per-asset)
- events: temporary modifiers applied to income (bull/bear/crash)
- prestigePoints: permanent currency earned on reset

## Asset Cost Scaling
For an asset with:
- baseCost
- costGrowth (e.g., 1.15)
- owned (integer >= 0)

Single purchase cost:
cost(owned) = baseCost * (costGrowth ^ owned)

Bulk purchase of k units (k >= 1):
sumCost = baseCost * (costGrowth ^ owned) * ((costGrowth ^ k - 1) / (costGrowth - 1))

## Asset Income
For an asset with:
- baseIncomePerSec
- owned

Base income contribution:
assetIncome = owned * baseIncomePerSec

Apply modifiers:
assetIncomeModified = assetIncome
  * (1 + sum(additiveAssetBonus))  [optional, can omit in MVP]
  * product(multiplicativeAssetMods)

Total income:
incomePerSec = sum(assetIncomeModified) * product(globalMultipliers) * eventMultiplier

## Global Multipliers
- Upgrades can add multiplicative multipliers to income.
- VIP can add:
  - offlineCapHours extension
  - optional +X% income multiplier (keep modest, e.g., 1.10)

## Offline Earnings
When returning after being away:
deltaSec = clamp(now - lastSeenAt, 0, offlineCapSec)
offlineEarnings = incomePerSec_at_last_save * deltaSec * offlineMultiplier

Rules:
- offlineCapSec: free cap (e.g., 8 hours), VIP cap (e.g., 24 hours)
- offlineMultiplier: 1.0 by default; can be boosted by “Offline Boost” item (e.g., 1.5 for 24h)
- Use the incomePerSec from last saved state (do not recalc with new purchases).

## Net Worth (for display)
netWorth = cash + sum(ownedAssetCount * currentAssetCostApprox)
Simple approximation:
assetValueApprox = owned * baseCost (or last known cost); keep for UI only.

## Prestige
Prestige unlock condition:
- netWorth >= prestigeMinNetWorth (e.g., 1e6)

Prestige points granted on reset:
pp = floor( (netWorth / prestigeDivisor) ^ prestigeExponent )
Example:
- prestigeDivisor = 1e6
- prestigeExponent = 0.5 (square root curve)

Permanent prestige multiplier:
prestigeMultiplier = 1 + (ppTotal * prestigeMultiplierPerPoint)
Example:
- prestigeMultiplierPerPoint = 0.01 (1% per point)

On reset:
- cash reset to 0
- owned assets reset to 0
- upgrades reset EXCEPT “permanent” upgrades (optional; keep none permanent in MVP)
- ppTotal increases by ppEarned
