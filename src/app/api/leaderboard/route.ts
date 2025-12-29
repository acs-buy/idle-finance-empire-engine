import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const metric = (url.searchParams.get("metric") ?? "net_worth").toLowerCase();
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);

    if (metric !== "net_worth") {
      return NextResponse.json({ error: "BAD_REQUEST", details: "Only metric=net_worth supported" }, { status: 400 });
    }

    // Auth required
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const admin = getSupabaseAdmin();

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const userId = userData.user.id;

    // Top list (authenticated users only) -> uses public.leaderboard
    let topRows: any[] | null = null;
    let topErr: { message?: string } | null = null;
    ({ data: topRows, error: topErr } = await admin
      .from("leaderboard")
      .select(
        "user_id, display_name, net_worth, income_value, income_unit, prestige_points, updated_at, portfolio",
      )
      .order("net_worth", { ascending: false })
      .limit(limit));

    if (topErr?.message?.includes("portfolio")) {
      ({ data: topRows, error: topErr } = await admin
        .from("leaderboard")
        .select("user_id, display_name, net_worth, income_value, income_unit, prestige_points, updated_at")
        .order("net_worth", { ascending: false })
        .limit(limit));
    }

    if (topErr) {
      return NextResponse.json({ error: "DB_ERROR", details: topErr.message }, { status: 500 });
    }

    // Me
    let meRow: any | null = null;
    let meErr: { message?: string } | null = null;
    ({ data: meRow, error: meErr } = await admin
      .from("leaderboard")
      .select("display_name, net_worth, income_value, income_unit, prestige_points, portfolio")
      .eq("user_id", userId)
      .maybeSingle());

    if (meErr?.message?.includes("portfolio")) {
      ({ data: meRow, error: meErr } = await admin
        .from("leaderboard")
        .select("display_name, net_worth, income_value, income_unit, prestige_points")
        .eq("user_id", userId)
        .maybeSingle());
    }

    // Rank = number of users strictly greater + 1
    let myRank: number | null = null;
    if (!meErr && meRow?.net_worth != null) {
      const { count, error: rankErr } = await admin
        .from("leaderboard")
        .select("*", { head: true, count: "exact" })
        .gt("net_worth", meRow.net_worth);

      if (!rankErr && typeof count === "number") myRank = count + 1;
    }

    const rows = topRows ?? [];
    const missingPortfolioUserIds = rows
      .filter((row) => !row.portfolio && row.user_id)
      .map((row) => row.user_id);

    let fallbackPortfolioByUserId = new Map<string, any>();
    if (missingPortfolioUserIds.length > 0) {
      const { data: fallbackRows, error: fallbackErr } = await admin
        .from("leaderboard_entries")
        .select("user_id, portfolio, updated_at")
        .in("user_id", missingPortfolioUserIds)
        .order("updated_at", { ascending: false });

      if (!fallbackErr && fallbackRows) {
        fallbackRows.forEach((row) => {
          if (!row.user_id || !row.portfolio) return;
          if (!fallbackPortfolioByUserId.has(row.user_id)) {
            fallbackPortfolioByUserId.set(row.user_id, row.portfolio);
          }
        });
      }
    }

    // Shape response
    const top =
      rows.map((r, idx) => ({
        rank: idx + 1,
        displayName: r.display_name ?? null,
        value: Number(r.net_worth),
        netWorthValue: Number(r.net_worth),
        incomeValue: r.income_value != null ? Number(r.income_value) : null,
        incomeUnit: r.income_unit ?? null,
        prestigePoints: Number(r.prestige_points),
        updatedAt: r.updated_at,
        portfolio: r.portfolio ?? fallbackPortfolioByUserId.get(r.user_id) ?? null,
      })) ?? [];

    let mePortfolio = meRow?.portfolio ?? null;
    if (!mePortfolio) {
      const { data: meFallbackRows, error: meFallbackErr } = await admin
        .from("leaderboard_entries")
        .select("portfolio, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!meFallbackErr && meFallbackRows && meFallbackRows[0]?.portfolio) {
        mePortfolio = meFallbackRows[0].portfolio;
      }
    }

    const me =
      meRow
        ? {
            rank: myRank,
            value: meRow.net_worth != null ? Number(meRow.net_worth) : null,
            netWorthValue: meRow.net_worth != null ? Number(meRow.net_worth) : null,
            incomeValue: meRow.income_value != null ? Number(meRow.income_value) : null,
            incomeUnit: meRow.income_unit ?? null,
            prestigePoints: meRow.prestige_points != null ? Number(meRow.prestige_points) : null,
            displayName: meRow.display_name ?? null,
            portfolio: mePortfolio,
          }
        : null;

    return NextResponse.json({ top, me });
  } catch (e: any) {
    return NextResponse.json({ error: "SERVER_ERROR", details: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
