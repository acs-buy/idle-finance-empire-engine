# MONETIZATION_SPEC.md

## Principles
- Monetization must not break core fun.
- Focus on optimization, convenience, and offline progression.
- No forced ads in MVP; optionally rewarded ads later.

## Products (Stripe)
### 1) VIP Monthly Subscription
- productId: vip_monthly
- benefits:
  - offlineCapHours: 24h (vs 8h free)
  - optional income multiplier: 1.10 (keep modest)
  - VIP badge + advanced stats (optional)
- entitlement logic:
  - vipUntil = subscription current_period_end

### 2) Offline Boost (24h)
- productId: offline_boost_24h
- one-time purchase
- benefit:
  - offlineMultiplier = 1.5 for 24 hours
- entitlement logic:
  - offlineBoostUntil = now + 24h

### 3) Auto-Invest Manager (permanent QoL)
- productId: auto_invest_manager
- one-time purchase
- benefit:
  - enables “auto-buy best ROI asset” toggle
- entitlement logic:
  - permanent flag in entitlements (V1 stored server-side)

## Checkout Flow (Web)
- Use Stripe Checkout session creation on server (Vercel route).
- Redirect to success/cancel pages.
- On success:
  - show confirmation
  - sync entitlements (V1 via webhook + fetch)

## Webhook (V1)
Listen for:
- checkout.session.completed
- invoice.paid
- customer.subscription.updated
- customer.subscription.deleted

Update entitlements table:
- vipUntil
- ownedPermanentFeatures (e.g., auto_invest_manager)
- offlineBoostUntil

## MVP Shortcut
For MVP you may:
- implement Stripe Checkout
- store entitlements locally after success redirect (best effort)
But V1 must validate via webhook to prevent fraud.

## Paywall Placement
- Soft CTA in header: “Go VIP”
- Strong CTA in Offline modal: “Extend offline to 24h”
- CTA in Prestige tab: “Optimize compounding with VIP stats”
