# Idle Finance Empire (Web)

Idle Finance Empire is a web-first idle/incremental finance simulation game.
Goal: validate acquisition + monetization on the web (Vercel) before any mobile port.

## Tech Stack
- Next.js (App Router)
- TypeScript (strict)
- Tailwind CSS
- pnpm (ONLY package manager)
- IndexedDB (local save)
- Stripe (V1 monetization)
- Supabase (V1 cloud save / leaderboard)

## Package Manager Rule (IMPORTANT)
This project MUST use pnpm.
- Do NOT use npm
- Do NOT use yarn
- Do NOT commit package-lock.json or yarn.lock

## Requirements
- Node.js >= 18
- pnpm >= 8

## Install
```bash
pnpm install
```

## Using Idle Engine as a Template
- Update `config/game.config.json` to change branding, landing copy, economy presets, and pricing labels.
- SaaS mode: set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to enable cloud save, leaderboard, and analytics storage.
- License mode: omit Supabase env vars to disable cloud features; the game runs locally with IndexedDB saves.
