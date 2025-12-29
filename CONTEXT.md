# CONTEXT.md

## Project
Name: Idle Finance Empire (working title)
Type: Web-first idle/incremental finance simulation game
Primary goal: Validate acquisition + monetization and reach €5,000 MRR on web (Vercel), then consider mobile later.

## Product Promise
“Experience compounding and financial empire building with zero real-world risk.”
This is a finance-flavored idle game (not an educational course, not investment advice).

## Target Users (ICP)
- Age: 22–45
- Interests: finance, investing, crypto, entrepreneurship, idle games
- Motivation: optimization, growth, “numbers go up”, portfolio mastery

## Platforms & Constraints
- Web-first (desktop + mobile web)
- Hosted on Vercel
- Must run smoothly on mobile Safari/Chrome
- MVP is offline-first and playable without login
- No real-money gambling mechanics

## Tech Stack (Required)
- Next.js (App Router) + TypeScript (strict)
- Styling: Tailwind (preferred) OR minimal CSS modules
- Local persistence: IndexedDB (preferred) with a fallback to localStorage
- Optional V1 backend: Supabase (Postgres) for cloud save, leaderboards, entitlements
- Payments: Stripe Checkout + Webhooks (server routes on Vercel)
- Analytics: lightweight event tracking (PostHog/Plausible compatible) + internal event bus

## Scope
### MVP (Must)
- /play route: game UI with 3 tabs: Dashboard, Invest, Upgrades/Prestige
- Core idle loop (tick-based) with deterministic formulas from FORMULAS.md
- Data-driven: assets/upgrades/events loaded from /data JSON files
- Save/load local + schema versioning and migrations
- Offline earnings (cap + VIP extension)
- Prestige reset system (basic)
- Marketing instrumentation (ANALYTICS_SPEC.md): UTM capture + events
- Landing page / with SEO + OpenGraph + CTA to /play (SEO_LANDING_SPEC.md)

### V1 (Next)
- Stripe Checkout + Webhooks + entitlements (MONETIZATION_SPEC.md)
- Email opt-in capture
- Optional Supabase: cloud save + leaderboards + server-side entitlements

### Out of scope (MVP)
- Multiplayer
- Real-time websockets
- Complex graphics/animations (keep it simple)
- Deep anti-cheat (basic integrity only)

## Architecture Rules
- Keep it simple, readable, testable.
- Avoid over-engineering and premature abstractions.
- Core engine is framework-agnostic (pure TypeScript), UI consumes it.
- Filesystem layout (recommended):
  - app/(marketing)/page.tsx
  - app/(game)/play/page.tsx
  - app/api/... (Stripe webhooks, optional save/leaderboard)
  - src/game/* (engine/economy/offline/prestige/state)
  - src/storage/* (indexeddb/localStorage)
  - src/analytics/*
  - data/*.json

## Code Quality
- TypeScript strict, no any.
- Pure functions for calculations.
- Deterministic state updates.
- Unit tests for economy formulas (at least: cost scaling, income computation, prestige points).

## UX Requirements
- “Wow moment” within 30 seconds: first purchase increases income/sec noticeably.
- Play without signup.
- Mobile-friendly layout.
- Clear metrics: Cash, Income/sec, Net Worth, Offline timer.

## Marketing Requirements (must be coded)
- Capture UTMs and referrer on first visit and store with player save.
- Track events per ANALYTICS_SPEC.md.
- Share feature: “Share my portfolio” generates a shareable text + OpenGraph-friendly URL (simple version: query params or share modal).

## Data Loading Rule
The /data folder is at the repository root (NOT public).
Therefore, configs MUST be loaded via static imports (bundled), never via fetch().

Examples:
- import assets from "@/data/assets.json"
- import upgrades from "@/data/upgrades.json"

Do NOT use fetch("/data/...").
