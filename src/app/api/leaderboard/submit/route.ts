import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubmitBody = {
  anonymousId: string;
  metric?: "net_worth"; // kept for API compatibility (DB is net_worth only)
  value?: number; // legacy net worth
  netWorthValue?: number;
  incomeValue?: number;
  incomeUnit?: string;
  prestigePoints?: number;
  displayName?: string;
  portfolio?: {
    income: Record<string, number>;
    netWorth: Record<string, number>;
  };
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getSupabaseAdmin() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Rate limit: 1 submit per 10 seconds per identity.
 * Uses Upstash REST if configured; otherwise fail-open (no limit).
 */
async function rateLimit(key: string): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return true; // fail-open

  const windowSec = 10;
  const redisKey = `rl:${key}`;

  const incrRes = await fetch(`${url}/incr/${encodeURIComponent(redisKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!incrRes.ok) return true; // fail-open
  const incrJson = (await incrRes.json()) as { result?: number };
  const count = incrJson.result ?? 0;

  if (count === 1) {
    // set TTL only at first hit
    await fetch(`${url}/expire/${encodeURIComponent(redisKey)}/${windowSec}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => {});
  }

  return count <= 1;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubmitBody;

    // Validate required fields
    const anonymousId = typeof body.anonymousId === "string" ? body.anonymousId.trim() : "";
    if (!anonymousId) {
      return NextResponse.json({ error: "BAD_REQUEST", details: "anonymousId required" }, { status: 400 });
    }

    const netWorthValueRaw = body.netWorthValue ?? body.value;
    const netWorthValue = Number(netWorthValueRaw);
    if (!Number.isFinite(netWorthValue) || netWorthValue < 0) {
      return NextResponse.json(
        { error: "BAD_REQUEST", details: "netWorthValue must be a positive number" },
        { status: 400 }
      );
    }

    const incomeValueRaw = body.incomeValue;
    const incomeValue =
      typeof incomeValueRaw === "number" && Number.isFinite(incomeValueRaw)
        ? incomeValueRaw
        : null;
    if (incomeValue !== null && incomeValue < 0) {
      return NextResponse.json(
        { error: "BAD_REQUEST", details: "incomeValue must be >= 0" },
        { status: 400 }
      );
    }

    const incomeUnit =
      typeof body.incomeUnit === "string" && body.incomeUnit.trim()
        ? body.incomeUnit.trim().slice(0, 20)
        : incomeValue !== null
          ? "per_min"
          : null;

    const prestigePointsRaw = body.prestigePoints ?? 0;
    const prestigePoints = Math.floor(Number(prestigePointsRaw));
    if (!Number.isFinite(prestigePoints) || prestigePoints < 0) {
      return NextResponse.json({ error: "BAD_REQUEST", details: "prestigePoints must be >= 0" }, { status: 400 });
    }

    const displayName =
      typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim().slice(0, 32)
        : null;

    const normalizePortfolio = (
      portfolio?: SubmitBody["portfolio"],
    ): SubmitBody["portfolio"] | null => {
      if (!portfolio) return null;
      const keys = ["realEstate", "markets", "business", "automation"];
      const normalize = (source: Record<string, number> | undefined) => {
        if (!source) return null;
        const values = keys.map((key) => source[key]);
        if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
          return null;
        }
        if (values.some((value) => value < 0)) return null;
        const sum = values.reduce((total, value) => total + value, 0);
        if (!Number.isFinite(sum) || sum <= 0) return null;
        const normalized = values.map((value) => value / sum);
        return keys.reduce<Record<string, number>>((acc, key, index) => {
          acc[key] = normalized[index] ?? 0;
          return acc;
        }, {});
      };

      const income = normalize(portfolio.income);
      const netWorth = normalize(portfolio.netWorth);
      if (!income || !netWorth) return null;
      return { income, netWorth };
    };

    const normalizedPortfolio = normalizePortfolio(body.portfolio);

    // Identify optional authenticated user
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    const admin = getSupabaseAdmin();

    let userId: string | null = null;

    if (token) {
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data?.user?.id) {
        userId = data.user.id;
      }
    }

    // Rate limit by identity (prefer userId if available)
    const rlKey = userId ? `u:${userId}` : `a:${anonymousId}`;
    const allowed = await rateLimit(rlKey);
    if (!allowed) {
      // Return OK to avoid breaking UX; simply drop burst submits
      return NextResponse.json({ ok: true, rateLimited: true }, { status: 200 });
    }

    const nowIso = new Date().toISOString();
    const netWorthClamped = Math.min(netWorthValue, 1e30);
    const incomeClamped = incomeValue !== null ? Math.min(incomeValue, 1e30) : null;

    // 1) Always upsert into leaderboard_entries (anonymous tracking)
    // NOTE: This requires a UNIQUE INDEX on anonymous_id (you said you added it in migration).
    let entryErr: { message?: string } | null = null;
    ({ error: entryErr } = await admin
      .from("leaderboard_entries")
      .upsert(
        {
          anonymous_id: anonymousId,
          user_id: userId,
          display_name: displayName,
          net_worth: netWorthClamped,
          income_value: incomeClamped,
          income_unit: incomeUnit,
          prestige_points: prestigePoints,
          portfolio: normalizedPortfolio,
          updated_at: nowIso,
        },
        { onConflict: "anonymous_id" }
      ));

    if (entryErr?.message?.includes("portfolio")) {
      ({ error: entryErr } = await admin
        .from("leaderboard_entries")
        .upsert(
          {
            anonymous_id: anonymousId,
            user_id: userId,
            display_name: displayName,
            net_worth: netWorthClamped,
            prestige_points: prestigePoints,
            updated_at: nowIso,
          },
          { onConflict: "anonymous_id" }
        ));
    }

    if (entryErr) {
      return NextResponse.json({ error: "DB_ERROR", details: entryErr.message }, { status: 500 });
    }

    // 2) If authenticated: upsert into leaderboard (authoritative leaderboard)
    if (userId) {
      let lbErr: { message?: string } | null = null;
      ({ error: lbErr } = await admin
        .from("leaderboard")
        .upsert(
          {
            user_id: userId,
          display_name: displayName,
          net_worth: netWorthClamped,
          income_value: incomeClamped,
          income_unit: incomeUnit,
          prestige_points: prestigePoints,
          portfolio: normalizedPortfolio,
          updated_at: nowIso,
        },
        { onConflict: "user_id" }
      ));

      if (lbErr?.message?.includes("portfolio")) {
        ({ error: lbErr } = await admin
          .from("leaderboard")
          .upsert(
            {
              user_id: userId,
            display_name: displayName,
            net_worth: netWorthClamped,
            prestige_points: prestigePoints,
            updated_at: nowIso,
          },
            { onConflict: "user_id" }
          ));
      }

      if (lbErr) {
        return NextResponse.json({ error: "DB_ERROR", details: lbErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: "SERVER_ERROR", details: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
