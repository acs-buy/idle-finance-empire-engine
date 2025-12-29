# ANALYTICS_SPEC.md

## Goals
Measure acquisition channel performance and conversion funnel.

## Identity
- anonymousId: persisted client-side (cookie or local storage)
- If user later logs in (V1), link anonymousId -> userId

## Required Properties (attach to all events)
- ts (epoch ms)
- anonymousId
- path
- referrer (initial)
- utm_source / utm_medium / utm_campaign / utm_term / utm_content (initial)
- deviceType: "mobile" | "desktop"
- country (optional, from edge headers if available)
- buildVersion (git SHA or app version)

## Events (MVP)
1) landing_view
2) click_play
3) game_start
4) first_purchase_asset
5) first_upgrade
6) prestige_unlocked
7) prestige_reset
8) vip_viewed
9) checkout_started
10) checkout_succeeded
11) session_end (durationSec)
12) share_clicked
13) email_optin

## Event Payloads
- game_start: { startingCash: number }
- first_purchase_asset: { assetId: string, newOwned: number, cashAfter: number }
- first_upgrade: { upgradeId: string, cashAfter: number }
- prestige_unlocked: { netWorth: number }
- prestige_reset: { ppEarned: number, ppTotal: number, netWorth: number }
- vip_viewed: { placement: "play_header" | "prestige_tab" | "offline_modal" }
- checkout_started: { productId: string, priceId?: string }
- checkout_succeeded: { productId: string, amount: number, currency: string }
- share_clicked: { shareType: "text" | "link" }
- email_optin: { source: "landing" | "play_modal" }

## Notes
- Track events client-side, but for payments confirm with server webhook in V1.
- Ensure UTM capture on first landing and persist into PlayerState.marketing.
