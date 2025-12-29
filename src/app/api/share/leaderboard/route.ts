import React from "react";
import { ImageResponse } from "next/og";
import defaultConfig from "../../../../../config/game.config.json";
import { validateGameConfig } from "@/engine/config/validate";
import type { GameConfig } from "@/engine/config/types";

export const runtime = "nodejs";

type LeaderboardRow = {
  user_id?: string | null;
  anonymous_id?: string | null;
  display_name?: string | null;
  net_worth?: number | null;
  income_value?: number | null;
  income_unit?: string | null;
  portfolio?: {
    income?: Record<string, number>;
    netWorth?: Record<string, number>;
  } | null;
};

const allocationColors: Record<string, string> = {
  real_estate: "#38bdf8",
  financial_markets: "#34d399",
  businesses: "#fbbf24",
  automation: "#a78bfa",
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function buildRestUrl(baseUrl: string, table: string, params: URLSearchParams) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/rest/v1/${table}`);
  url.search = params.toString();
  return url.toString();
}

async function fetchRow(
  baseUrl: string,
  serviceKey: string,
  table: string,
  params: URLSearchParams,
): Promise<LeaderboardRow | null> {
  const response = await fetch(buildRestUrl(baseUrl, table, params), {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const data = (await response.json()) as LeaderboardRow[];
  return data[0] ?? null;
}

async function fetchRankCount(
  baseUrl: string,
  serviceKey: string,
  table: string,
  netWorth: number,
): Promise<number | null> {
  const params = new URLSearchParams();
  params.set("select", "net_worth");
  params.set("net_worth", `gt.${netWorth}`);

  const response = await fetch(buildRestUrl(baseUrl, table, params), {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: "count=exact",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const range = response.headers.get("content-range");
  if (!range) return null;
  const match = range.match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") === "income" ? "income" : "netWorth";
    const anonymousId = url.searchParams.get("anonymousId");
    const userId = url.searchParams.get("userId");

    if (!anonymousId && !userId) {
      return new Response("Missing identity", { status: 400 });
    }

    const config = validateGameConfig(defaultConfig as GameConfig, defaultConfig as GameConfig);
    const baseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const selectFields =
      "user_id, anonymous_id, display_name, net_worth, income_value, income_unit, portfolio";
    let row: LeaderboardRow | null = null;

    if (userId) {
      const params = new URLSearchParams();
      params.set("select", selectFields);
      params.set("user_id", `eq.${userId}`);
      params.set("limit", "1");
      row = await fetchRow(baseUrl, serviceKey, "leaderboard", params);
    }

    if (!row && anonymousId) {
      const params = new URLSearchParams();
      params.set("select", selectFields);
      params.set("anonymous_id", `eq.${anonymousId}`);
      params.set("limit", "1");
      row = await fetchRow(baseUrl, serviceKey, "leaderboard_entries", params);
    }

    if (!row) {
      return new Response("Not found", { status: 404 });
    }

    const netWorth = Number(row.net_worth ?? 0);
    const incomeValue = Number(row.income_value ?? 0);
    const value = mode === "income" ? incomeValue : netWorth;
    const unitSuffix = mode === "income" && row.income_unit === "per_min" ? " / min" : "";

    const rankTable = userId ? "leaderboard" : "leaderboard_entries";
    const count = await fetchRankCount(baseUrl, serviceKey, rankTable, netWorth);
    const rank = typeof count === "number" ? count + 1 : null;

    const portfolio = (row as LeaderboardRow).portfolio?.[mode] ?? null;
    const segments = [
      { id: "real_estate", value: portfolio?.realEstate ?? 0 },
      { id: "financial_markets", value: portfolio?.markets ?? 0 },
      { id: "businesses", value: portfolio?.business ?? 0 },
      { id: "automation", value: portfolio?.automation ?? 0 },
    ];
    const total = segments.reduce((sum, s) => sum + s.value, 0);

    const h = React.createElement;
    const bar = h(
      "div",
      {
        style: {
          height: 18,
          width: "100%",
          borderRadius: 999,
          overflow: "hidden",
          background: "rgba(255,255,255,0.1)",
          display: "flex",
        },
      },
      segments.map((segment) => {
        const percent = total > 0 ? segment.value / total : 0;
        return h("div", {
          key: segment.id,
          style: {
            width: `${percent * 100}%`,
            background: allocationColors[segment.id],
          },
        });
      }),
    );

    const root = h(
      "div",
      {
        style: {
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
          background: "linear-gradient(135deg, #0f172a, #0b1224)",
          color: "#f8fafc",
          fontFamily: "system-ui, sans-serif",
        },
      },
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between" } },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column" } },
          h("div", { style: { fontSize: 18, letterSpacing: 6, opacity: 0.7 } }, "LEADERBOARD"),
          h(
            "div",
            { style: { fontSize: 44, fontWeight: 700, marginTop: 12 } },
            config.game.name,
          ),
        ),
        rank !== null
          ? h(
              "div",
              {
                style: {
                  background: "rgba(255,255,255,0.1)",
                  padding: "14px 22px",
                  borderRadius: 999,
                  fontSize: 18,
                },
              },
              `Rank #${rank}`,
            )
          : null,
      ),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        h(
          "div",
          { style: { fontSize: 22, opacity: 0.75 } },
          mode === "income" ? "Income" : "Net Worth",
        ),
        h(
          "div",
          { style: { fontSize: 56, fontWeight: 700, marginTop: 8 } },
          `${formatCurrency(value, config.game.currency)}${unitSuffix}`,
        ),
      ),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        h(
          "div",
          { style: { fontSize: 16, opacity: 0.7, marginBottom: 12 } },
          "Portfolio Allocation",
        ),
        bar,
      ),
    );

    return new ImageResponse(root, { width: 1200, height: 630 });
  } catch (error) {
    return new Response("Server error", { status: 500 });
  }
}
